// Funnel-Events für den Meta-Pixel.
//
// Der Pixel selbst wird in app/layout.tsx geladen und feuert dort bereits
// PageView. Hier liegen nur die Funnel-Schritte, damit im Events Manager
// sichtbar wird, WO Leute abspringen — bisher war nur das Endergebnis
// (Lead) messbar, was jede Diagnose unmöglich machte.
//
// "Lead" ist ein Meta-Standardevent und muss über track() laufen, alles
// andere sind Custom Events über trackCustom().

const STANDARD_EVENTS = new Set(['Lead', 'CompleteRegistration', 'Contact']);

type FbqParams = Record<string, string | number | boolean>;

export function track(event: string, params?: FbqParams): void {
  if (typeof window === 'undefined') return;
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq !== 'function') return;

  const method = STANDARD_EVENTS.has(event) ? 'track' : 'trackCustom';
  if (params) fbq(method, event, params);
  else fbq(method, event);
}
