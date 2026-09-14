// Qualifizierungs-Logik für das Fulfillmentbuddy-Quiz.
// Rein additive Punktzahl 0–100, dient intern der Priorisierung im CRM —
// wird dem Nutzer selbst nicht angezeigt (kein "Score-Reveal" im Funnel).

export type QuizAnswers = {
  /** Wird aus der Paketzahl des Rechners abgeleitet (volumeBracket), nicht mehr abgefragt. */
  volume: string;
  /** Rolle im Unternehmen — der direkte Filter gegen Formularausfüller ohne Shop. */
  role: string;
  storage: string;
  situation: string;
  challenge: string;
  urgency: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  shopUrl?: string;
  phoneVerified?: boolean;
  /** Rohwerte aus dem Paketkosten-Rechner, fürs CRM mitgeschickt. */
  parcelsPerMonth?: number;
  costPerParcel?: number;
  laborSharePct?: number;
  fteEquivalent?: number;
};

const VOLUME_POINTS: Record<string, number> = {
  'Unter 500': 5,
  '500–1.000': 15,
  '1.000–2.000': 25,
  '2.000+': 35,
};

// Lagerbedarf in Paletten/Monat — höherer Bedarf = größerer, wertvollerer Lead.
const STORAGE_POINTS: Record<string, number> = {
  '0–10': 5,
  '10–20': 15,
  '30–50': 25,
  '50+': 35,
  'Nicht sicher': 10,
};

// Rolle des Ausfüllenden. Nach der ersten Testrunde bewusst mit im Score:
// dort kamen mehrheitlich Leads, die die Anzeige für ein Jobangebot hielten.
const ROLE_POINTS: Record<string, number> = {
  'Inhaber / Geschäftsführung': 20,
  'Betrieb / Logistik': 10,
  'Andere': 0,
};

const SITUATION_POINTS: Record<string, number> = {
  'Inhouse / selbst': 15,
  'Dienstleister vorhanden, aber unzufrieden': 25,
  'Noch kein Fulfillment-Partner': 10,
  'Wachstum übersteigt aktuelle Kapazität': 25,
};

const URGENCY_POINTS: Record<string, number> = {
  'Akut — wir suchen jetzt': 30,
  'In den nächsten 1–3 Monaten': 20,
  'Explorativ, wir informieren uns': 5,
};

export function scoreLead(answers: QuizAnswers): number {
  const points =
    (VOLUME_POINTS[answers.volume] ?? 0) +
    (ROLE_POINTS[answers.role] ?? 0) +
    (STORAGE_POINTS[answers.storage] ?? 0) +
    (SITUATION_POINTS[answers.situation] ?? 0) +
    (URGENCY_POINTS[answers.urgency] ?? 0);
  return Math.min(100, points);
}

/**
 * Harte Ausschlussgründe, unabhängig vom Score. Der Score ist eine Summe und
 * kann einen Ausschlussgrund durch hohe Punkte an anderer Stelle überdecken —
 * genau das darf bei diesen beiden nicht passieren, weil sie die Lieferbarkeit
 * an den Kunden entscheiden.
 */
export function leadBlockers(answers: QuizAnswers): string[] {
  const blockers: string[] = [];
  if (answers.role === 'Andere') blockers.push('Rolle im Unternehmen unklar');
  if (answers.volume === 'Unter 500') blockers.push('Unter 500 Sendungen/Monat');
  return blockers;
}

export function statusForLead(answers: QuizAnswers, score: number): string {
  if (leadBlockers(answers).length > 0) return 'Nicht lieferbar';
  return score >= 55 ? 'Qualifiziert' : 'Neuer Lead';
}
