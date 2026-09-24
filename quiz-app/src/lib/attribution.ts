// Herkunft eines Leads festhalten (Client-seitig).
//
// Ohne das laesst sich nicht sagen, welche Anzeige welchen Lead gebracht hat —
// und damit auch kein Creative-Test auswerten: die Meta-Zahlen enden beim
// Klick, das CRM beginnt beim Formular. Die UTM-Parameter schliessen die
// Luecke.
//
// Die Herkunft wird an ZWEI Stellen gehalten:
//
//   1) Im Arbeitsspeicher der Quiz-Komponente, gelesen beim ersten Rendern.
//      Das ist die verlaessliche Quelle: das Quiz laeuft seit dem Funnel-Umbau
//      komplett auf einer Seite ab, der Wert muss also keinen Seitenwechsel
//      ueberleben.
//   2) Zusaetzlich in sessionStorage, damit ein Reload mitten im Quiz die
//      Zuordnung nicht kostet.
//
// Frueher hing die Zuordnung allein an (2) — und ging damit jedes Mal
// verloren, wenn der Browser den Speicher verweigert. Genau das passiert in
// den In-App-Browsern von Instagram und Facebook mit aktivem Tracking-Schutz,
// also ausgerechnet bei der Haelfte des bezahlten Traffics. Lead 875114371291
// (23.09.2026) kam so ohne jede Herkunft an, nicht einmal mit Einstiegsseite.
//
// Kein Cookie: der Wert wird rein technisch fuer die Zuordnung der eigenen
// Anfrage gebraucht und verlaesst die Session nicht.

const STORAGE_KEY = 'fb_attribution';

export type LeadAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingUrl?: string;
  referrer?: string;
};

function clean(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : undefined;
}

function hasAnyValue(a: LeadAttribution): boolean {
  return Object.values(a).some(Boolean);
}

/** Traegt die Anzeige, ueber die der Lead kam — der Teil, der zaehlt. */
function hasUtm(a: LeadAttribution): boolean {
  return Boolean(a.utmSource || a.utmMedium || a.utmCampaign || a.utmContent);
}

/** Die aktuelle Seite auslesen. Ohne Speicher, ohne Seiteneffekt. */
function fromWindow(): LeadAttribution {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: clean(params.get('utm_source')),
    utmMedium: clean(params.get('utm_medium')),
    utmCampaign: clean(params.get('utm_campaign')),
    utmContent: clean(params.get('utm_content')),
    utmTerm: clean(params.get('utm_term')),
    landingUrl: clean(window.location.href),
    referrer: clean(document.referrer),
  };
}

/**
 * Beim ersten Seitenaufruf die Parameter sichern — und zurueckgeben, damit
 * der Aufrufer sie im Arbeitsspeicher behalten kann.
 *
 * Ein spaeterer Aufruf ohne UTMs (z.B. nach einem Reload auf die nackte URL)
 * darf einen bereits gespeicherten Wert nicht ueberschreiben — sonst geht die
 * Zuordnung genau dann verloren, wenn der Nutzer besonders lange ueberlegt hat.
 */
export function captureAttribution(): LeadAttribution {
  const fresh = fromWindow();
  if (!hasAnyValue(fresh)) return fresh;

  try {
    const stored = readAttribution();
    if (hasUtm(stored) && !hasUtm(fresh)) return stored;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // sessionStorage kann blockiert sein (Private Mode, In-App-Browser,
    // strenge Einstellungen). Der Rueckgabewert steht davon unabhaengig —
    // genau dafuer gibt es ihn.
  }

  return fresh;
}

export function readAttribution(): LeadAttribution {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LeadAttribution) : {};
  } catch {
    return {};
  }
}

/**
 * Was beim Absenden mitgeschickt wird.
 *
 * `captured` ist der Wert aus dem Arbeitsspeicher der Komponente. Der
 * gespeicherte Wert bekommt Vorrang, solange er eine Anzeige benennt: er kann
 * aus einem frueheren Aufruf derselben Session stammen, bei dem die URL die
 * UTMs noch trug. Verweigert der Browser den Speicher, bleibt `captured` —
 * und damit mindestens Einstiegsseite und Referrer.
 */
export function resolveAttribution(captured: LeadAttribution): LeadAttribution {
  const stored = readAttribution();
  if (hasUtm(stored)) return stored;
  if (hasUtm(captured)) return captured;
  return hasAnyValue(captured) ? captured : stored;
}
