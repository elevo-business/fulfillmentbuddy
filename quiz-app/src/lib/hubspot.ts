// Anbindung an HubSpot CRM (Contacts API, Private-App-Token).
//
// Bewusst KEIN HubSpot-Formular und KEIN Tracking-Code: das Quiz bleibt
// unverändert, es kommt keine weitere Cookie-/Consent-Baustelle dazu. Der
// Server postet den fertigen Lead direkt gegen die CRM-API.
//
// Design-Prinzip wie bei der monday-Anbindung: robust gegen ein noch nicht
// eingerichtetes Portal. HubSpot legt unbekannte Properties NICHT automatisch
// an und quittiert sie mit 400 — ein einziges fehlendes Feld würde also den
// ganzen Lead verlieren. Deshalb:
//   1) Property-Schema des Portals zur Laufzeit abfragen (kurz gecacht).
//   2) Nur Properties senden, die tatsächlich existieren; fehlende werden
//      ohne Fehler übersprungen. Custom Properties können jederzeit im
//      HubSpot-UI nachgelegt werden und füllen sich ab dann von selbst.
//   3) Unabhängig davon landen IMMER alle Antworten als vollständiger,
//      lesbarer Text in der Standard-Property `message` — so geht nie etwas
//      verloren, auch wenn noch keine einzige Custom Property existiert.

import type { QuizAnswers } from './scoring';
import { scoreLead, statusForLead, leadBlockers, intentTier } from './scoring';

// Umschaltbar aus zwei Gruenden:
//   1) EU-Portale (app-eu1.hubspot.com, Token im Format pat-eu1-...). Ob
//      api.hubapi.com dorthin automatisch richtig routet, ist nicht sauber
//      dokumentiert. Faellt der erste Aufruf mit einem Hublet-/Routing-Fehler
//      durch, reicht HUBSPOT_API_BASE_URL=https://api-eu1.hubapi.com.
//   2) Tests gegen einen lokalen Mock.
// Ohne die Variable gilt der Standard-Endpunkt.
const HUBSPOT_API_URL = process.env.HUBSPOT_API_BASE_URL || 'https://api.hubapi.com';

/** Woher der Lead kam — aus den URL-Parametern der Landingpage. */
export type LeadAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingUrl?: string;
  referrer?: string;
};

/**
 * HubSpot hat die E-Mail-Adresse abgelehnt.
 *
 * Eigener Typ, weil das der einzige Fehlerfall ist, den der Nutzer selbst
 * beheben kann — und der einzige, bei dem ein Fallback in ein anderes CRM
 * das Falsche waere: die Adresse ist dann dort zwar gespeichert, aber
 * unbrauchbar. Besser sofort nachfragen, solange der Interessent noch auf
 * der Seite ist. HubSpot prueft strenger als unsere eigene Regex (u.a.
 * gegen existierende TLDs), faengt also echte Tippfehler ab.
 */
export class HubspotInvalidEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HubspotInvalidEmailError';
  }
}

export function isHubspotConfigured(): boolean {
  return Boolean(process.env.HUBSPOT_PRIVATE_APP_TOKEN);
}

function token(): string {
  const key = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!key) {
    throw new Error(
      'HUBSPOT_PRIVATE_APP_TOKEN ist nicht gesetzt (Server-Umgebungsvariable in Coolify prüfen).'
    );
  }
  return key;
}

async function hubspotRequest<T>(
  path: string,
  init: { method: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${HUBSPOT_API_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });

  // HubSpot antwortet bei Auth-/Rate-Limit-Fehlern nicht immer mit sauberem
  // JSON — Status + Rohtext zuerst sichern, damit der geloggte Fehler
  // tatsächlich etwas aussagt.
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`HubSpot ${init.method} ${path} → Status ${res.status}: ${rawText.slice(0, 400)}`);
  }
  if (!rawText) return undefined as T;
  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(
      `HubSpot ${init.method} ${path} antwortete mit Status ${res.status} und keinem gültigen JSON: ${rawText.slice(0, 300)}`
    );
  }
}

// --- Property-Schema -------------------------------------------------------

type PropertyMeta = {
  name: string;
  /** 'enumeration' o.ä. — bei Auswahllisten dürfen nur gültige Werte rein. */
  type: string;
  /** Erlaubte internen Werte bei Auswahllisten, sonst null. */
  options: Set<string> | null;
};

const PROPERTY_CACHE_TTL_MS = 5 * 60_000;
let propertyCache: { at: number; props: Map<string, PropertyMeta> } | null = null;

/**
 * Property-Schema des Portals holen — oder `null`, wenn das nicht geht.
 *
 * Der Abruf braucht den Scope `crm.schemas.contacts.read`. Fehlt der, war
 * vorher der ganze Lead verloren, obwohl das blosse Anlegen eines Kontakts
 * nur `crm.objects.contacts.write` braucht. Das Schema ist aber nur eine
 * Optimierung: es erlaubt, optionale Custom Properties mitzuschicken. Faellt
 * es aus, wird eben ohne sie geschrieben — statt gar nicht.
 */
async function getContactProperties(): Promise<Map<string, PropertyMeta> | null> {
  const now = Date.now();
  if (propertyCache && now - propertyCache.at < PROPERTY_CACHE_TTL_MS) {
    return propertyCache.props;
  }

  let data: { results: { name: string; type: string; options?: { value: string }[] }[] };
  try {
    data = await hubspotRequest('/crm/v3/properties/contacts', { method: 'GET' });
  } catch (err) {
    console.warn(
      'HubSpot-Property-Schema nicht abrufbar — Lead wird mit den Standardfeldern ' +
        'angelegt. Fuer die optionalen fb_*-Properties fehlt vermutlich der Scope ' +
        'crm.schemas.contacts.read.',
      err
    );
    return null;
  }

  const props = new Map<string, PropertyMeta>();
  for (const p of data.results) {
    props.set(p.name, {
      name: p.name,
      type: p.type,
      options: p.options?.length ? new Set(p.options.map((o) => o.value)) : null,
    });
  }

  propertyCache = { at: now, props };
  return props;
}

/**
 * Properties, die es in jedem HubSpot-Portal gibt und die alle vom Typ Text
 * sind — also ohne Options-Pruefung gefahrlos sendbar. Das ist der Rueckfall,
 * wenn das Schema nicht gelesen werden kann. Bewusst ohne Auswahllisten
 * (`lifecyclestage`, `hs_lead_status`): deren gueltige Optionen sind pro
 * Portal konfigurierbar, ein falscher Wert kostet mit 400 den ganzen Lead.
 */
const ALWAYS_PRESENT_PROPERTIES = new Set([
  'email',
  'firstname',
  'lastname',
  'phone',
  'company',
  'website',
  'message',
]);

// --- Gemeinsamer Feldsatz fuer die Lead-Uebersicht ------------------------
//
// Die Leads kommen aus zwei Quellen, die in voellig getrennte Properties
// schreiben: das Quiz hier ueber die CRM-API, die Meta-Lead-Ads ueber den
// HubSpot-Connector in seine eigenen, anders benannten Felder
// (`wie_viele_bestellungen_...`). Eine Tabellenansicht ueber alle Leads
// braucht daher Spalten, die BEIDE Quellen fuellen — das sind die
// `lead_*`-Properties. Die quellenspezifischen Felder (`fb_*` hier, die
// Lead-Ad-Felder dort) bleiben daneben bestehen, sie tragen die Details.
//
// Die Bestellmengen-Stufen der beiden Formulare passen nicht aufeinander
// (Meta: "unter 250" ... "2000+", Quiz: siehe VOLUME_OPTIONS). Sie werden
// deshalb NICHT auf eine gemeinsame Skala gemappt — das waere erfundene
// Genauigkeit. Stattdessen wandert die Originalangabe als Text nach
// `lead_bestellungen`, und `lead_bestellungen_min` traegt die untere Grenze
// als Zahl, damit sich die Liste sortieren und filtern laesst.

/** Untere Grenze der Bestellmengen-Spanne aus VOLUME_OPTIONS. */
const VOLUME_LOWER_BOUND: Record<string, number> = {
  '0–100': 0,
  '100–500': 100,
  '500–1.000': 500,
  '1.000–5.000': 1000,
  '5.000+': 5000,
};

// --- Lead-Zusammenfassung --------------------------------------------------

function formatLeadSummary(
  answers: QuizAnswers,
  score: number,
  suspectedBot: boolean,
  attribution: LeadAttribution
): string {
  const blockers = leadBlockers(answers);
  const source = [
    attribution.utmSource && `Quelle: ${attribution.utmSource}`,
    attribution.utmMedium && `Medium: ${attribution.utmMedium}`,
    attribution.utmCampaign && `Kampagne: ${attribution.utmCampaign}`,
    attribution.utmContent && `Anzeige/Zelle: ${attribution.utmContent}`,
    attribution.utmTerm && `Term: ${attribution.utmTerm}`,
    attribution.referrer && `Referrer: ${attribution.referrer}`,
  ].filter(Boolean) as string[];

  return [
    `Neuer Quiz-Lead von fulfillmentbuddy.de`,
    ...(suspectedBot
      ? [
          ``,
          `⚠️ SPAM-VERDACHT: Das Honeypot-Feld war ausgefüllt. Kann ein Bot`,
          `sein — oder ein echter Interessent, dessen Browser das unsichtbare`,
          `Feld automatisch befüllt hat. Vor dem Verwerfen kurz prüfen.`,
        ]
      : []),
    ``,
    `Firma: ${answers.company}`,
    `Ansprechpartner: ${answers.name}`,
    `E-Mail: ${answers.email}`,
    `Telefon: ${answers.phone}`,
    `Shoplink: ${answers.shopUrl || '—'}`,
    ``,
    `Rolle: ${answers.role}`,
    `Bestellungen/Monat: ${answers.volume}`,
    `Fulfillment aktuell: ${answers.process}`,
    `Zeitaufwand/Woche: ${answers.timeSpent}`,
    `Größte Herausforderung: ${answers.challenge}`,
    `Wachstum (12 Monate): ${answers.growth}`,
    `Wichtigstes Kriterium: ${answers.priority}`,
    `Intent: ${intentTier(answers)}`,
    ``,
    `Lead-Score: ${score}/100 (${statusForLead(answers, score)})`,
    blockers.length ? `Ausschlussgründe: ${blockers.join(', ')}` : `Ausschlussgründe: keine`,
    ...(source.length ? [``, `Herkunft:`, ...source.map((s) => `  ${s}`)] : []),
    ...(attribution.landingUrl ? [`  Einstiegsseite: ${attribution.landingUrl}`] : []),
  ].join('\n');
}

function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstname: parts[0], lastname: '' };
  return { firstname: parts.slice(0, -1).join(' '), lastname: parts[parts.length - 1] };
}

// --- Lead anlegen / aktualisieren ------------------------------------------

export async function submitLeadToHubspot(
  answers: QuizAnswers,
  options: { suspectedBot?: boolean; attribution?: LeadAttribution } = {}
): Promise<{ contactId: string; score: number }> {
  const score = scoreLead(answers);
  const suspectedBot = Boolean(options.suspectedBot);
  const attribution = options.attribution ?? {};
  const blockers = leadBlockers(answers);
  const { firstname, lastname } = splitName(answers.name);

  const schema = await getContactProperties();
  const properties: Record<string, string> = {};

  // Nur setzen, was das Portal kennt. Bei Auswahllisten zusätzlich prüfen,
  // ob der Wert als Option hinterlegt ist — HubSpot lehnt unbekannte
  // Optionen sonst mit 400 ab und der Lead wäre verloren.
  const set = (name: string, value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === '') return;
    const str = String(value);

    // Ohne Schema nur die Felder senden, die jedes Portal sicher kennt.
    if (!schema) {
      if (ALWAYS_PRESENT_PROPERTIES.has(name)) properties[name] = str;
      return;
    }

    const meta = schema.get(name);
    if (!meta) return;
    if (meta.options && !meta.options.has(str)) return;
    properties[name] = str;
  };

  // Standard-Properties
  set('email', answers.email);
  set('firstname', firstname);
  set('lastname', lastname);
  set('phone', answers.phone);
  set('company', answers.company);
  set('website', answers.shopUrl);
  set('lifecyclestage', 'lead');
  set('hs_lead_status', blockers.length ? 'UNQUALIFIED' : 'NEW');
  set('message', formatLeadSummary(answers, score, suspectedBot, attribution));

  // Optionale Custom Properties — existieren sie nicht, passiert nichts.
  // Anlegen im HubSpot-UI unter Einstellungen → Properties → Contact.
  set('fb_score', score);
  set('fb_status', statusForLead(answers, score));
  set('fb_blockers', blockers.join(', '));
  set('fb_intent', intentTier(answers));
  set('fb_role', answers.role);
  set('fb_volume', answers.volume);
  set('fb_process', answers.process);
  set('fb_time_spent', answers.timeSpent);
  set('fb_challenge', answers.challenge);
  set('fb_growth', answers.growth);
  set('fb_priority', answers.priority);
  set('fb_suspected_bot', suspectedBot ? 'true' : 'false');
  set('fb_utm_source', attribution.utmSource);
  set('fb_utm_medium', attribution.utmMedium);
  set('fb_utm_campaign', attribution.utmCampaign);
  set('fb_utm_content', attribution.utmContent);
  set('fb_utm_term', attribution.utmTerm);
  set('fb_landing_url', attribution.landingUrl);
  set('fb_referrer', attribution.referrer);

  // Gemeinsamer Feldsatz — siehe Kommentar bei VOLUME_LOWER_BOUND. Fehlen die
  // Properties im Portal noch, ueberspringt set() sie folgenlos.
  set('lead_quelle', 'Website-Quiz');
  set('lead_bestellungen', answers.volume);
  set('lead_bestellungen_min', VOLUME_LOWER_BOUND[answers.volume]);
  set('lead_rolle', answers.role);
  set('lead_herausforderung', answers.challenge);
  set('lead_score', score);
  set('lead_shoplink', answers.shopUrl);
  // `lead_produkte` und `lead_zeitfenster` fragt das Quiz nicht ab — die
  // Spalten bleiben bei Website-Leads leer und tragen nur die Meta-Antworten.

  // Upsert über die E-Mail: ein Interessent, der das Quiz ein zweites Mal
  // ausfüllt, soll denselben Kontakt aktualisieren statt eine Dublette zu
  // erzeugen. Das erspart auch die 409-Behandlung eines reinen Create.
  let data: { results: { id: string }[] };
  try {
    data = await hubspotRequest('/crm/v3/objects/contacts/batch/upsert', {
      method: 'POST',
      body: { inputs: [{ idProperty: 'email', id: answers.email, properties }] },
    });
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    if (text.includes('INVALID_EMAIL')) {
      throw new HubspotInvalidEmailError(text);
    }
    throw err;
  }

  const contactId = data.results?.[0]?.id;
  if (!contactId) {
    throw new Error('HubSpot-Upsert lieferte keine Kontakt-ID zurück.');
  }

  return { contactId, score };
}

/**
 * Traegt die Werte des optionalen Paketkosten-Rechners an einem BEREITS
 * angelegten Kontakt nach. Bewusst kein zweiter Upsert-Aufruf mit vollem
 * Payload: der Rechner laeuft nach dem Absenden, es ist derselbe Lead.
 */
export async function enrichContactWithCosts(
  contactId: string,
  costs: {
    parcelsPerMonth: number;
    costPerParcel: number;
    laborSharePct: number;
    fteEquivalent: number;
  }
): Promise<void> {
  const schema = await getContactProperties();
  // Die Rechnerwerte liegen ausschliesslich in Custom Properties. Ohne
  // lesbares Schema laesst sich nicht pruefen, ob es sie gibt — dann lieber
  // nichts schicken als den Nachtrag an einem 400 scheitern lassen.
  if (!schema) return;

  const properties: Record<string, string> = {};
  const set = (name: string, value: number) => {
    if (!schema.has(name)) return;
    properties[name] = String(value);
  };

  set('fb_parcels_per_month', costs.parcelsPerMonth);
  set('fb_cost_per_parcel', costs.costPerParcel);
  set('fb_labor_share_pct', costs.laborSharePct);
  set('fb_fte_equivalent', costs.fteEquivalent);

  if (Object.keys(properties).length === 0) return;

  await hubspotRequest(`/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    body: { properties },
  });
}
