// Ergebnis-Logik für den Fulfillment-Check.
//
// Wichtig: KEINE Statistik-Datenbank, kein Benchmark-Vergleich, keine
// Einsparversprechen. Wir haben keine belastbaren Branchenzahlen und
// erfinden auch keine. Jeder Baustein ist eine strukturelle Einordnung
// der Angaben, die der Nutzer selbst gemacht hat.
//
// Abgrenzung zu scoring.ts: Der Lead-Score dort ist intern
// (CRM-Priorisierung) und wird dem Nutzer NICHT gezeigt. Diese Datei
// erzeugt ausschließlich das, was der Prospect am Ende sieht.

import type { QuizAnswers } from './scoring';
import { intentTier } from './scoring';

export type Assessment = {
  /** Überschrift der Ergebnisseite, abgeleitet aus Volumen und Wachstum */
  headline: string;
  /** Ampel für die Einschätzung */
  signal: 'green' | 'amber' | 'neutral';
  /** Die Einschätzung in einem Satz */
  verdict: string;
  /** Warum wir das so einordnen — bezieht sich auf die eigenen Angaben */
  reasoning: string;
  /** Was der Prospect auch ohne uns als Nächstes prüfen kann */
  nextStep: string;
  /** Wie es mit uns weitergeht */
  followUp: string;
};

const HEADLINE: Record<string, string> = {
  high: 'Dein Shop wächst. Dein Fulfillment sollte mithalten.',
  medium: 'Dein Fulfillment ist an der Grenze zum Auslagern.',
  low: 'Für dein aktuelles Volumen lohnt sich Auslagern noch nicht zwingend.',
};

const VERDICT: Record<string, string> = {
  high: 'Ausgelagertes Fulfillment könnte für deinen Shop bereits deutlich sinnvoll sein.',
  medium: 'Ausgelagertes Fulfillment könnte sich für deinen Shop bald rechnen.',
  low: 'Ausgelagertes Fulfillment ist bei deiner aktuellen Größenordnung selten der erste Hebel.',
};

// Begründung aus der Kombination Prozess + Zeitaufwand. Beschreibt nur,
// was die Angaben bedeuten, ohne eine Ersparnis zu behaupten.
function buildReasoning(answers: QuizAnswers): string {
  const inhouse =
    answers.process === 'Ich mache es selbst' || answers.process === 'Eigenes Team';
  const viel =
    answers.timeSpent === '15–30 Stunden' || answers.timeSpent === '30+ Stunden';

  if (inhouse && viel) {
    return `Ihr wickelt den Versand selbst ab und bindet dafür ${answers.timeSpent.toLowerCase()}. Diese Zeit steckt in Gehältern und taucht pro Paket nie auf. Genau dort entscheidet sich, ob Auslagern für euch rechnet.`;
  }
  if (inhouse) {
    return 'Ihr wickelt den Versand selbst ab. Der Aufwand hält sich aktuell in Grenzen, wächst aber typischerweise nicht linear, sondern sprunghaft mit dem Bestellvolumen.';
  }
  if (answers.process === 'Teilweise ausgelagert') {
    return 'Ein Teil läuft schon extern. Bei geteilten Prozessen liegt der Hebel meist weniger im Stückpreis als in den Schnittstellen zwischen euch und dem Dienstleister.';
  }
  return 'Ihr habt bereits vollständig ausgelagert. Dann geht es nicht um das Ob, sondern darum, ob euer aktueller Anbieter noch zu eurem Volumen und euren Zielen passt.';
}

// Konkreter Prüfschritt zur genannten Herausforderung. Der Prospect kann
// ihn auch ohne uns gehen — das ist Absicht.
const NEXT_STEP: Record<string, string> = {
  'Zu wenig Lagerplatz':
    'Rechnet mit eurem Peak-Bedarf, nicht mit dem Durchschnitt. Fulfillment-Verträge scheitern im November, nicht im Juni, und die Kapazität dafür wird im Sommer verhandelt.',
  'Zu viel Personalaufwand':
    'Rechnet einmal aus, wie viele Vollzeitstellen der Versand bei euch bindet. Die Zahl überrascht die meisten Gründer und ist die ehrlichste Vergleichsgrundlage gegen jedes Angebot.',
  'Zu viel Zeitaufwand':
    'Haltet eine Woche lang fest, wie viele Stunden tatsächlich in Packen, Labeln und Retouren fließen. Geschätzte Zeit ist fast immer zu niedrig geschätzt.',
  Versandkosten:
    'Trennt beim Vergleich Porto von Abwicklung. Porto zahlt ihr mit und ohne Dienstleister, vergleichbar ist nur der Handling-Anteil.',
  Retouren:
    'Fragt bei jedem Angebot die Retourenkosten pro Stück separat ab. Sie stehen selten in der Preisliste und entscheiden bei hoher Retourenquote über die gesamte Kalkulation.',
  'Wachstum / Skalierung':
    'Fragt Peak-Kapazität konkret in Stück pro Tag ab und ab wann sie angemeldet sein muss. "Machen wir schon" ist keine Zusage, eine Zahl im Vertrag schon.',
};

const FOLLOW_UP: Record<string, string> = {
  high: 'Wir gleichen deine Angaben mit passenden Fulfillment-Anbietern ab und melden uns kurzfristig.',
  medium: 'Wir gleichen deine Angaben mit passenden Anbietern ab und melden uns in den nächsten Tagen.',
  low: 'Wir melden uns, sobald wir einen Anbieter sehen, der auch bei kleinerem Volumen zu euch passt.',
};

export function buildAssessment(answers: QuizAnswers): Assessment {
  const tier = intentTier(answers);
  const signal: Assessment['signal'] =
    tier === 'high' ? 'green' : tier === 'medium' ? 'amber' : 'neutral';

  return {
    headline: HEADLINE[tier],
    signal,
    verdict: VERDICT[tier],
    reasoning: buildReasoning(answers),
    nextStep: NEXT_STEP[answers.challenge] ?? NEXT_STEP['Zu viel Zeitaufwand'],
    followUp: FOLLOW_UP[tier],
  };
}
