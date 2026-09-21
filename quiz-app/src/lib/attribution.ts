// Herkunft eines Leads festhalten (Client-seitig).
//
// Ohne das laesst sich nicht sagen, welche Anzeige welchen Lead gebracht hat —
// und damit auch kein Creative-Test auswerten: die Meta-Zahlen enden beim
// Klick, das CRM beginnt beim Formular. Die UTM-Parameter schliessen die
// Luecke.
//
// Gespeichert wird in sessionStorage, nicht in einem Cookie: der Wert wird
// rein technisch fuer die Zuordnung der eigenen Anfrage gebraucht, verlaesst
// die Session nicht und ueberlebt trotzdem einen Reload waehrend des Quiz.

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

/**
 * Beim ersten Seitenaufruf die Parameter sichern. Ein spaeterer Aufruf ohne
 * UTMs (z.B. nach einem Reload auf die nackte URL) darf einen bereits
 * gespeicherten Wert nicht ueberschreiben — sonst geht die Zuordnung genau
 * dann verloren, wenn der Nutzer besonders lange ueberlegt hat.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh: LeadAttribution = {
      utmSource: clean(params.get('utm_source')),
      utmMedium: clean(params.get('utm_medium')),
      utmCampaign: clean(params.get('utm_campaign')),
      utmContent: clean(params.get('utm_content')),
      utmTerm: clean(params.get('utm_term')),
      landingUrl: clean(window.location.href),
      referrer: clean(document.referrer),
    };

    const stored = readAttribution();
    const storedHasUtm = Boolean(
      stored.utmSource || stored.utmMedium || stored.utmCampaign || stored.utmContent
    );
    const freshHasUtm = Boolean(
      fresh.utmSource || fresh.utmMedium || fresh.utmCampaign || fresh.utmContent
    );
    if (storedHasUtm && !freshHasUtm) return;
    if (!hasAnyValue(fresh)) return;

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // sessionStorage kann blockiert sein (Private Mode, strenge Einstellungen).
    // Attribution ist Beiwerk — ein Lead darf daran nie scheitern.
  }
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
