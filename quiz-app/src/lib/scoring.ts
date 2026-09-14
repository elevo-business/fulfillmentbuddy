// Qualifizierungs-Logik für den Fulfillment-Check.
//
// Der Score ist intern (CRM-Priorisierung) und wird dem Nutzer NICHT
// gezeigt. Was der Nutzer sieht, erzeugt assessment.ts.
//
// Ziel ist ausdrücklich nicht die maximale Lead-Anzahl, sondern der
// qualifizierte E-Commerce-Shop. Deshalb gibt es neben dem additiven
// Score harte Ausschlussgründe, die ein hoher Score an anderer Stelle
// nicht überdecken darf.

export type QuizAnswers = {
  /** Rolle im Unternehmen — Gate vor dem Check, filtert Nicht-Zielgruppe */
  role: string;
  /** Bestellungen pro Monat */
  volume: string;
  /** Wie das Fulfillment heute abgewickelt wird */
  process: string;
  /** Zeitaufwand pro Woche */
  timeSpent: string;
  /** Größte aktuelle Herausforderung */
  challenge: string;
  /** Wachstumsziel der nächsten 12 Monate */
  growth: string;
  /** Was dem Shop beim Fulfillment am wichtigsten wäre */
  priority: string;

  name: string;
  company: string;
  email: string;
  phone: string;
  shopUrl?: string;
  phoneVerified?: boolean;

  /** Optionale Rohwerte aus dem Paketkosten-Rechner (Zusatzschritt nach dem Ergebnis) */
  parcelsPerMonth?: number;
  costPerParcel?: number;
  laborSharePct?: number;
  fteEquivalent?: number;
};

export const VOLUME_OPTIONS = ['0–100', '100–500', '500–1.000', '1.000–5.000', '5.000+'];
export const PROCESS_OPTIONS = [
  'Ich mache es selbst',
  'Eigenes Team',
  'Teilweise ausgelagert',
  'Vollständig ausgelagert',
];
export const TIME_OPTIONS = [
  'Unter 5 Stunden/Woche',
  '5–15 Stunden',
  '15–30 Stunden',
  '30+ Stunden',
];
export const CHALLENGE_OPTIONS = [
  'Zu wenig Lagerplatz',
  'Zu viel Personalaufwand',
  'Zu viel Zeitaufwand',
  'Versandkosten',
  'Retouren',
  'Wachstum / Skalierung',
];
export const GROWTH_OPTIONS = ['Unter 10 %', '10–30 %', '30–100 %', 'Mehr als 100 %'];
export const PRIORITY_OPTIONS = [
  'Zeit sparen',
  'Kosten reduzieren',
  'Skalieren',
  'Weniger operative Arbeit',
  'Professionellere Prozesse',
];
export const ROLE_OPTIONS = ['Inhaber / Geschäftsführung', 'Betrieb / Logistik', 'Andere'];

const VOLUME_POINTS: Record<string, number> = {
  '0–100': 0,
  '100–500': 8,
  '500–1.000': 18,
  '1.000–5.000': 30,
  '5.000+': 35,
};

// Wer schon vollständig ausgelagert hat, ist für eine Vermittlung am
// wenigsten interessant. Inhouse mit eigenem Aufwand ist der Kern.
const PROCESS_POINTS: Record<string, number> = {
  'Ich mache es selbst': 25,
  'Eigenes Team': 22,
  'Teilweise ausgelagert': 15,
  'Vollständig ausgelagert': 5,
};

const TIME_POINTS: Record<string, number> = {
  'Unter 5 Stunden/Woche': 3,
  '5–15 Stunden': 10,
  '15–30 Stunden': 18,
  '30+ Stunden': 25,
};

const GROWTH_POINTS: Record<string, number> = {
  'Unter 10 %': 2,
  '10–30 %': 8,
  '30–100 %': 15,
  'Mehr als 100 %': 20,
};

// Rolle bleibt im Score, obwohl "Andere" bereits am Gate abgefangen wird —
// als Sicherheitsnetz, falls das Gate je umgangen oder geändert wird.
const ROLE_POINTS: Record<string, number> = {
  'Inhaber / Geschäftsführung': 15,
  'Betrieb / Logistik': 8,
  'Andere': 0,
};

export function scoreLead(answers: QuizAnswers): number {
  const points =
    (VOLUME_POINTS[answers.volume] ?? 0) +
    (PROCESS_POINTS[answers.process] ?? 0) +
    (TIME_POINTS[answers.timeSpent] ?? 0) +
    (GROWTH_POINTS[answers.growth] ?? 0) +
    (ROLE_POINTS[answers.role] ?? 0);
  return Math.min(100, points);
}

export type IntentTier = 'high' | 'medium' | 'low';

export function intentTier(answers: QuizAnswers): IntentTier {
  const score = scoreLead(answers);
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

/**
 * Harte Ausschlussgründe, unabhängig vom Score. Der Score ist eine Summe
 * und kann einen Ausschlussgrund durch hohe Punkte an anderer Stelle
 * überdecken — genau das darf bei diesen beiden nicht passieren, weil sie
 * über die Lieferbarkeit an den Fulfillment-Kunden entscheiden.
 */
export function leadBlockers(answers: QuizAnswers): string[] {
  const blockers: string[] = [];
  if (answers.role === 'Andere') blockers.push('Rolle im Unternehmen unklar');
  if (answers.volume === '0–100') blockers.push('Unter 100 Bestellungen/Monat');
  return blockers;
}

export function statusForLead(answers: QuizAnswers, score: number): string {
  if (leadBlockers(answers).length > 0) return 'Nicht lieferbar';
  const tier = intentTier(answers);
  if (tier === 'high') return 'Qualifiziert';
  if (tier === 'medium') return 'Neuer Lead';
  return 'Nicht qualifiziert';
}
