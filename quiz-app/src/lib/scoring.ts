// Qualifizierungs-Logik für das Fulfillmentbuddy-Quiz.
// Rein additive Punktzahl 0–100, dient intern der Priorisierung im CRM —
// wird dem Nutzer selbst nicht angezeigt (kein "Score-Reveal" im Funnel).

export type QuizAnswers = {
  segment: string;
  volume: string;
  storage: string;
  situation: string;
  challenge: string;
  urgency: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  shopUrl?: string;
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

const SEGMENT_POINTS: Record<string, number> = {
  'E-Commerce & Online-Handel': 10,
  'Marke mit Lagerbedarf': 8,
  'Multichannel-Anbieter': 10,
  Sonstiges: 5,
};

export function scoreLead(answers: QuizAnswers): number {
  const points =
    (VOLUME_POINTS[answers.volume] ?? 0) +
    (STORAGE_POINTS[answers.storage] ?? 0) +
    (SITUATION_POINTS[answers.situation] ?? 0) +
    (URGENCY_POINTS[answers.urgency] ?? 0) +
    (SEGMENT_POINTS[answers.segment] ?? 0);
  return Math.min(100, points);
}

export function statusForScore(score: number): string {
  return score >= 55 ? 'Qualifiziert' : 'Neuer Lead';
}
