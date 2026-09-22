import { NextRequest, NextResponse } from 'next/server';
import { submitLeadToMonday } from '@/lib/monday';
import { submitLeadToHubspot, isHubspotConfigured, HubspotInvalidEmailError } from '@/lib/hubspot';
import type { LeadAttribution } from '@/lib/hubspot';
import type { QuizAnswers } from '@/lib/scoring';

// 'priority' und 'phone' stehen bewusst NICHT mehr hier.
//   - Die Frage nach dem wichtigsten Kriterium floss weder in den Score
//     noch in die Einschaetzung ein; sie kostete nur einen Schritt.
//   - Die Telefonnummer ist im Formular optional geworden. Vier
//     Pflichtfelder waren eines zu viel; die Nummer ist das Feld, an dem
//     abgebrochen wird.
// Beide bleiben im Typ und werden weiter gespeichert, wenn sie ankommen.
const REQUIRED_FIELDS: (keyof QuizAnswers)[] = [
  'role',
  'volume',
  'process',
  'timeSpent',
  'challenge',
  'growth',
  'name',
  'company',
  'email',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sehr einfacher In-Memory-Rate-Limiter (pro Server-Instanz) gegen
// versehentliches Doppel-Submit / grobe Spam-Bots. Kein Ersatz für einen
// echten WAF-Schutz, aber ausreichend für einen Low-Traffic-B2B-Funnel.
const recentSubmissions = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const last = recentSubmissions.get(ip);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_WINDOW_MS) return true;
  recentSubmissions.set(ip, now);
  // simple cleanup to avoid unbounded growth
  if (recentSubmissions.size > 1000) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    for (const [key, ts] of recentSubmissions) {
      if (ts < cutoff) recentSubmissions.delete(key);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Zu viele Anfragen, bitte kurz warten.' }, { status: 429 });
  }

  let body: Partial<QuizAnswers>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || String(body[field]).trim() === '') {
      return NextResponse.json({ error: `Feld fehlt: ${field}` }, { status: 400 });
    }
  }
  if (!EMAIL_RE.test(body.email!)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
  }

  // Honeypot: unsichtbares Feld, das nur Bots ausfüllen sollten.
  //
  // Früher wurde hier still mit 200 geantwortet und nichts angelegt. Der
  // Client kann das nicht von Erfolg unterscheiden: er feuert trotzdem das
  // Meta-Lead-Event und zeigt dem Nutzer den Erfolgsbildschirm. Am 11.09.
  // sind so zwei Anfragen spurlos verschwunden — Browser-Autofill und
  // Passwortmanager füllen ein Feld namens "website" regelmäßig mit, obwohl
  // es unsichtbar ist und autoComplete="off" trägt.
  //
  // Bei diesem Lead-Volumen ist ein durchgerutschter Bot ungleich billiger
  // als ein verlorener echter Lead. Deshalb: immer anlegen, Verdacht nur
  // markieren. `website` wird mitgeprüft, damit noch ausgelieferte alte
  // Clients während des Rollouts weiter korrekt behandelt werden.
  const raw = body as Record<string, unknown>;
  const suspectedBot = Boolean(raw.contactReference || raw.website);
  if (suspectedBot) {
    console.warn('Honeypot ausgelöst — Lead wird trotzdem angelegt', {
      company: body.company,
      email: body.email,
    });
  }

  const attribution = readAttribution(raw);

  // CRM-Wechsel monday -> HubSpot.
  //
  // HubSpot ist das Ziel, monday bleibt waehrend der Umstellung als Notnagel
  // stehen: solange MONDAY_API_KEY gesetzt ist, faengt es einen Ausfall der
  // HubSpot-Seite auf. Ist der Wechsel durch, reicht es, die Variable in
  // Coolify zu entfernen — dann faellt der Zweig von selbst weg.
  //
  // Was hier NICHT passieren darf: dem Nutzer Erfolg melden, ohne dass der
  // Lead irgendwo liegt. Ein Lead-Event ohne Eintrag dahinter laesst Meta auf
  // Phantom-Conversions optimieren. Deshalb wird nur `ok` gemeldet, wenn eine
  // echte Datensatz-ID zurueckkam.
  const failures: string[] = [];

  if (isHubspotConfigured()) {
    try {
      const { score, contactId } = await submitLeadToHubspot(body as QuizAnswers, {
        suspectedBot,
        attribution,
      });
      return NextResponse.json({ ok: true, score, itemId: contactId, crm: 'hubspot' });
    } catch (err) {
      // Abgelehnte E-Mail ist kein Ausfall, sondern ein Tippfehler. Nicht in
      // ein anderes CRM ausweichen — dort laege die Adresse zwar, waere aber
      // unbrauchbar. Stattdessen nachfragen, solange der Interessent noch da
      // ist: das rettet den Lead, ein 502 verliert ihn.
      if (err instanceof HubspotInvalidEmailError) {
        console.warn('Lead abgelehnt: ungueltige E-Mail', { email: body.email });
        return NextResponse.json(
          {
            error:
              'Diese E-Mail-Adresse konnten wir nicht bestätigen. Bitte prüf sie kurz auf einen Tippfehler.',
            field: 'email',
          },
          { status: 400 }
        );
      }
      failures.push(`hubspot: ${err instanceof Error ? err.message : String(err)}`);
      console.error('hubspot submit failed', err);
    }
  } else {
    failures.push('hubspot: HUBSPOT_PRIVATE_APP_TOKEN nicht gesetzt');
  }

  if (process.env.MONDAY_API_KEY) {
    try {
      const { score, itemId } = await submitLeadToMonday(body as QuizAnswers, { suspectedBot });
      console.warn('Lead ueber monday-Fallback angelegt — HubSpot-Pfad pruefen', { itemId });
      return NextResponse.json({ ok: true, score, itemId, crm: 'monday' });
    } catch (err) {
      failures.push(`monday: ${err instanceof Error ? err.message : String(err)}`);
      console.error('monday submit failed', err);
    }
  }

  // Beide Senken tot: den vollstaendigen Lead ins Log schreiben, damit er
  // aus den Coolify-Logs rekonstruierbar ist, statt ersatzlos zu verschwinden.
  console.error(
    'LEAD NICHT GESPEICHERT — kein CRM erreichbar. Vollstaendiger Payload folgt.',
    JSON.stringify({ lead: body, attribution, suspectedBot, failures })
  );

  return NextResponse.json(
    { error: 'Übermittlung fehlgeschlagen. Bitte später erneut versuchen.' },
    { status: 502 }
  );
}

/**
 * Liest die Herkunftsdaten aus dem Payload. Der Client schickt sie mit; fehlen
 * sie (aelterer, noch ausgelieferter Client), bleibt das Feld leer — der Lead
 * darf daran nicht scheitern.
 */
function readAttribution(raw: Record<string, unknown>): LeadAttribution {
  const str = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    // Deckel gegen aufgeblaehte Query-Strings.
    return trimmed.slice(0, 500);
  };
  const src = (raw.attribution ?? {}) as Record<string, unknown>;
  return {
    utmSource: str(src.utmSource),
    utmMedium: str(src.utmMedium),
    utmCampaign: str(src.utmCampaign),
    utmContent: str(src.utmContent),
    utmTerm: str(src.utmTerm),
    landingUrl: str(src.landingUrl),
    referrer: str(src.referrer),
  };
}
