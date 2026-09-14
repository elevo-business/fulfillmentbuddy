// Paketkosten-Rechner — der Leadmagnet vor dem Fragenteil.
//
// Zweck: Der Interessent rechnet seine EIGENEN Ist-Kosten pro Paket aus.
// Das qualifiziert von sich aus, weil nur jemand mit eigenem Versand diese
// Zahlen überhaupt kennt.
//
// WICHTIG, gleiche Linie wie assessment.ts: Hier steht kein einziger
// Branchen-Benchmark und kein Vergleichswert. Wir haben keine belastbaren
// Marktzahlen und erfinden auch keine. Alles unten ist reine Arithmetik auf
// den Eingaben des Nutzers. Die beiden Konstanten sind Umrechnungen, keine
// Annahmen über seinen Betrieb:
//   WEEKS_PER_MONTH        = 52/12, Wochen pro Monat
//   FULLTIME_HOURS_PER_MONTH = 40-Stunden-Woche auf denselben Monat gerechnet
//
// Porto ist absichtlich NICHT Teil der Rechnung. Versandkosten zum Carrier
// zahlt der Shop mit und ohne Dienstleister, sie verzerren den Vergleich nur.
// Gerechnet wird der Abwicklungsaufwand: Personal, Verpackung, Fläche.

const WEEKS_PER_MONTH = 52 / 12;
const FULLTIME_HOURS_PER_MONTH = 40 * WEEKS_PER_MONTH;

export type CostInputs = {
  /** Pakete pro Monat */
  parcels: number;
  /** Gesamtstunden pro Woche, die alle Beteiligten zusammen für den Versand aufwenden */
  hoursPerWeek: number;
  /** Interner Stundensatz in Euro (Vollkosten, also inkl. Arbeitgeberanteil) */
  hourlyRate: number;
  /** Verpackungsmaterial pro Paket in Euro (Karton, Füllmaterial, Etikett) */
  packagingPerParcel: number;
  /** Lagermiete pro Monat in Euro, 0 wenn keine separate Fläche */
  warehouseRent: number;
};

export type CostResult = {
  laborPerMonth: number;
  packagingPerMonth: number;
  rentPerMonth: number;
  totalPerMonth: number;
  costPerParcel: number;
  laborPerParcel: number;
  /** Anteil Personal an den Gesamtkosten, 0 bis 1 */
  laborShare: number;
  hoursPerMonth: number;
  /** Wie viele Vollzeitstellen die genannten Stunden binden */
  fteEquivalent: number;
};

export const EMPTY_COST_INPUTS: Record<keyof CostInputs, string> = {
  parcels: '',
  hoursPerWeek: '',
  hourlyRate: '',
  packagingPerParcel: '',
  warehouseRent: '',
};

/** Akzeptiert deutsche Kommazahlen ("2,40") und liefert NaN bei Unsinn. */
export function parseNumber(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function calculateCosts(input: CostInputs): CostResult {
  const parcels = Math.max(1, input.parcels);
  const hoursPerMonth = input.hoursPerWeek * WEEKS_PER_MONTH;
  const laborPerMonth = hoursPerMonth * input.hourlyRate;
  const packagingPerMonth = input.packagingPerParcel * parcels;
  const rentPerMonth = input.warehouseRent;
  const totalPerMonth = laborPerMonth + packagingPerMonth + rentPerMonth;

  return {
    laborPerMonth,
    packagingPerMonth,
    rentPerMonth,
    totalPerMonth,
    costPerParcel: totalPerMonth / parcels,
    laborPerParcel: laborPerMonth / parcels,
    laborShare: totalPerMonth > 0 ? laborPerMonth / totalPerMonth : 0,
    hoursPerMonth,
    fteEquivalent: hoursPerMonth / FULLTIME_HOURS_PER_MONTH,
  };
}

/**
 * Leitet die Volumen-Kategorie aus der genannten Paketzahl ab. Die Labels
 * müssen zeichengleich zu VOLUME_POINTS in scoring.ts und zu den Werten in
 * der monday-Spalte "Bestellvolumen/Monat" bleiben — sonst fällt die
 * Punktevergabe still auf 0 und bestehende CRM-Daten passen nicht mehr dazu.
 */
export function volumeBracket(parcels: number): string {
  if (parcels < 500) return 'Unter 500';
  if (parcels < 1000) return '500–1.000';
  if (parcels <= 2000) return '1.000–2.000';
  return '2.000+';
}

export function euro(value: number): string {
  return value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: value < 100 ? 2 : 0,
  });
}

export function formatHours(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 0 });
}
