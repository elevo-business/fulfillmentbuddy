import { NextRequest, NextResponse } from 'next/server';
import { submitLeadToMonday } from '@/lib/monday';
import type { QuizAnswers } from '@/lib/scoring';

const REQUIRED_FIELDS: (keyof QuizAnswers)[] = [
  'role',
  'volume',
  'process',
  'timeSpent',
  'challenge',
  'growth',
  'priority',
  'name',
  'company',
  'email',
  'phone',
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

  try {
    const { score, itemId } = await submitLeadToMonday(body as QuizAnswers, { suspectedBot });
    return NextResponse.json({ ok: true, score, itemId });
  } catch (err) {
    console.error('monday submit failed', err);
    return NextResponse.json(
      { error: 'Übermittlung fehlgeschlagen. Bitte später erneut versuchen.' },
      { status: 502 }
    );
  }
}
