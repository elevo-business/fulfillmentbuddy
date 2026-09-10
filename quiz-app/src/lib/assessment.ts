// Ergebnis-Logik für den Kurzcheck.
//
// Wichtig: Das hier ist bewusst KEINE Statistik-Datenbank und kein
// Benchmark-Vergleich — wir haben keine belastbaren Branchenzahlen und
// erfinden auch keine. Jeder Textbaustein ist eine strukturelle Einordnung
// der Angaben, die der Nutzer selbst gemacht hat, plus ein konkreter
// Prüfschritt, den er auch ohne uns gehen kann.
//
// Abgrenzung zu scoring.ts: Der Lead-Score dort ist intern (CRM-Priorisierung)
// und wird dem Nutzer NICHT gezeigt. Diese Datei erzeugt ausschließlich das,
// was der Prospect am Ende zu sehen bekommt.

import type { QuizAnswers } from './scoring';

export type Assessment = {
  /** Einordnung der Größenordnung (aus Sendungsvolumen) */
  scale: string;
  /** Zusatz zum Lagerbedarf, falls er die Einordnung verändert */
  storage: string | null;
  /** Was die geschilderte Ausgangslage strukturell bedeutet */
  situation: string;
  /** Konkreter nächster Prüfschritt zur genannten Herausforderung */
  nextStep: string;
  /** Wann wir uns melden — abgeleitet aus der Dringlichkeit */
  followUp: string;
};

const SCALE: Record<string, string> = {
  'Unter 500':
    'Unter 500 Sendungen im Monat rechnet sich Auslagern selten automatisch. Die entscheidende Größe ist hier nicht der Stückpreis, sondern wie viele Stunden das Packen bei euch bindet — und was diese Stunden wert sind.',
  '500–1.000':
    '500 bis 1.000 Sendungen im Monat ist die Größenordnung, in der Fulfillment zur Rechenaufgabe wird: Ab hier lässt sich externe Abwicklung seriös gegen eure eigenen Kosten rechnen, vorher ist es meist Bauchgefühl.',
  '1.000–2.000':
    'Bei 1.000 bis 2.000 Sendungen im Monat ist die Frage nicht mehr ob, sondern wie. Ab dieser Größe hängen Lieferzeit und Fehlerquote an der Prozessqualität — nicht mehr am Einsatz einzelner Leute.',
  '2.000+':
    'Über 2.000 Sendungen im Monat schlägt jeder Prozentpunkt Fehlerquote und jeder Tag Lieferzeit unmittelbar auf Umsatz und Retourenquote durch. Auf dem Niveau ist Fulfillment kein Kostenposten mehr, sondern Teil des Produkts.',
};

const STORAGE: Record<string, string | null> = {
  '0–10': null,
  '10–20': null,
  '30–50':
    'Mit 30 bis 50 Paletten im Monat kommt Lagerfläche als zweiter Kostenblock neben der Abwicklung dazu — Angebote sind ab hier nur vergleichbar, wenn Fläche und Handling getrennt ausgewiesen sind.',
  '50+':
    'Ab 50 Paletten im Monat ist Lagerfläche ein eigener Verhandlungsgegenstand. Wer nur Stückpreise vergleicht, übersieht auf dem Niveau den größeren Hebel.',
  'Nicht sicher':
    'Beim Lagerbedarf lohnt sich vor jedem Gespräch eine grobe Zahl. Sie verändert Angebote oft stärker als die Sendungsmenge — und ohne sie bekommt ihr nur Spannen statt Preisen.',
};

const SITUATION: Record<string, string> = {
  'Inhouse / selbst':
    'Ihr macht es selbst. Damit ist euer Engpass nicht der Preis, sondern eure eigene Zeit und Fläche — und beides skaliert nicht mit dem Umsatz mit.',
  'Dienstleister vorhanden, aber unzufrieden':
    'Ihr habt einen Dienstleister, aber es passt nicht. Die Vorfrage vor jedem Wechsel: Ist es ein Prozessproblem — dann ist es lösbar — oder ein Kapazitätsproblem? Kapazität lässt sich nicht nachverhandeln.',
  'Noch kein Fulfillment-Partner':
    'Ohne bestehenden Partner startet ihr auf einem leeren Blatt. Das ist ein Vorteil: Ihr könnt die Kriterien setzen, statt einen laufenden Vertrag zu reparieren.',
  'Wachstum übersteigt aktuelle Kapazität':
    'Wachstum über der eigenen Kapazität ist der teuerste Zustand im Fulfillment. Ihr bezahlt ihn in Lieferzeit, Support-Aufwand und Nerven — nur taucht er auf keiner Rechnung auf.',
};

const NEXT_STEP: Record<string, string> = {
  'Steigende Fehlerquote & Retouren':
    'Holt euch die Pick-Fehlerquote der letzten drei Monate in Zahlen — eure eigene oder die eures Dienstleisters. Ohne Zahl lässt sich weder etwas verbessern noch etwas vergleichen. Wer sie nicht liefern kann, misst sie nicht.',
  'Lagerkapazität am Limit':
    'Rechnet ab jetzt mit dem Peak-Bedarf, nicht mit dem Durchschnitt. Fulfillment-Verträge scheitern im November, nicht im Juni — und die Kapazität dafür wird im Sommer verhandelt.',
  'Saisonale Spitzen (z. B. Black Friday)':
    'Fragt Peak-Kapazität konkret in Stück pro Tag ab — und ab wann sie angemeldet sein muss. „Machen wir schon" ist keine Zusage, eine Zahl im Vertrag schon.',
  'Lieferzeiten & Kundenerwartung':
    'Setzt an der Cut-off-Zeit an, nicht am Preis. Eine Stunde späterer Cut-off kann einen kompletten Liefertag sparen — und wirkt beim Kunden stärker als jeder Cent Ersparnis pro Paket.',
  'Intransparente Kosten':
    'Verlangt eine Beispielrechnung für einen echten Monat aus eurer Historie statt einer Preisliste pro Position. Erst an einem realen Monat zeigen sich Lagergebühren, Mindermengen und Retourenkosten.',
};

const FOLLOW_UP: Record<string, string> = {
  'Akut — wir suchen jetzt': 'Weil ihr akut sucht, melden wir uns kurzfristig.',
  'In den nächsten 1–3 Monaten': 'Wir melden uns in den nächsten Tagen.',
  'Explorativ, wir informieren uns': 'Wir melden uns in Ruhe — ohne Druck im Nacken.',
};

export function buildAssessment(answers: QuizAnswers): Assessment {
  return {
    scale: SCALE[answers.volume] ?? SCALE['500–1.000'],
    storage: STORAGE[answers.storage] ?? null,
    situation: SITUATION[answers.situation] ?? SITUATION['Inhouse / selbst'],
    nextStep: NEXT_STEP[answers.challenge] ?? NEXT_STEP['Intransparente Kosten'],
    followUp: FOLLOW_UP[answers.urgency] ?? FOLLOW_UP['In den nächsten 1–3 Monaten'],
  };
}
