'use client';

import { useEffect, useState } from 'react';
import { buildAssessment } from '@/lib/assessment';
import { captureAttribution, readAttribution } from '@/lib/attribution';
import { track } from '@/lib/tracking';
import {
  ROLE_OPTIONS,
  VOLUME_OPTIONS,
  PROCESS_OPTIONS,
  TIME_OPTIONS,
  CHALLENGE_OPTIONS,
  GROWTH_OPTIONS,
} from '@/lib/scoring';
import {
  calculateCosts,
  parseNumber,
  euro,
  formatHours,
  EMPTY_COST_INPUTS,
  type CostInputs,
  type CostResult,
} from '@/lib/costCalc';

type Answers = {
  role: string;
  volume: string;
  process: string;
  timeSpent: string;
  challenge: string;
  growth: string;
  priority: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  shopUrl: string;
  /** Honeypot. Name bewusst ohne URL-Semantik — siehe Kommentar am Feld. */
  contactReference: string;
};

const EMPTY_ANSWERS: Answers = {
  role: '',
  volume: '',
  process: '',
  timeSpent: '',
  challenge: '',
  growth: '',
  priority: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  shopUrl: '',
  contactReference: '',
};

type QuestionKey = 'volume' | 'process' | 'timeSpent' | 'challenge' | 'growth' | 'role';

type Question = {
  key: QuestionKey;
  question: string;
  options: string[];
};

/**
 * Reihenfolge ist bewusst gewaehlt.
 *
 * Die Rollenfrage stand frueher als eigenes Gate VOR dem Quiz. Dort sind
 * laut Pixel 25 % der Leute verschwunden, die den CTA schon geklickt
 * hatten: Die erste Interaktion war ein Filter, kein Nutzen. Jetzt steht
 * sie als letzte Frage — wer fuenf Fragen beantwortet hat, beantwortet
 * auch die sechste.
 *
 * Herausgefallen ist "Was waere dir am wichtigsten?". Sie floss weder in
 * den Score noch in die Einschaetzung ein und kostete nur einen Schritt.
 * So bleibt es bei den sechs Fragen, die die Anzeigen versprechen.
 */
const QUESTIONS: Question[] = [
  { key: 'volume', question: 'Wie viele Bestellungen verschickst du aktuell pro Monat?', options: VOLUME_OPTIONS },
  { key: 'process', question: 'Wie wird dein Fulfillment aktuell abgewickelt?', options: PROCESS_OPTIONS },
  { key: 'timeSpent', question: 'Wie viel Zeit verbringt dein Team ungefähr mit Fulfillment?', options: TIME_OPTIONS },
  { key: 'challenge', question: 'Was ist aktuell deine größte Herausforderung?', options: CHALLENGE_OPTIONS },
  { key: 'growth', question: 'Wie stark soll dein Shop in den nächsten 12 Monaten wachsen?', options: GROWTH_OPTIONS },
  { key: 'role', question: 'Welche Rolle hast du im Unternehmen?', options: ROLE_OPTIONS },
];

type CalcField = {
  key: keyof CostInputs;
  label: string;
  hint?: string;
  suffix: string;
  /** 0 ist eine gültige Antwort (z.B. kein separates Lager) */
  allowZero?: boolean;
};

const CALC_FIELDS: CalcField[] = [
  { key: 'parcels', label: 'Pakete pro Monat', suffix: 'Pakete' },
  {
    key: 'hoursPerWeek',
    label: 'Stunden pro Woche für Packen und Versand',
    hint: 'Alle Beteiligten zusammengerechnet.',
    suffix: 'Std.',
    allowZero: true,
  },
  {
    key: 'hourlyRate',
    label: 'Interner Stundensatz',
    hint: 'Vollkosten, also inklusive Arbeitgeberanteil.',
    suffix: '€ / Std.',
  },
  {
    key: 'packagingPerParcel',
    label: 'Verpackungsmaterial pro Paket',
    hint: 'Karton, Füllmaterial, Etikett.',
    suffix: '€',
    allowZero: true,
  },
  {
    key: 'warehouseRent',
    label: 'Lagermiete pro Monat',
    hint: 'Null eintragen, wenn keine separate Fläche anfällt.',
    suffix: '€',
    allowZero: true,
  },
];

/**
 * Reihenfolge der Phasen: Das Ergebnis kommt VOR der Kontaktabfrage.
 *
 * Vorher lag es dahinter. Laut Pixel haben 41 Leute alle sechs Fragen
 * beantwortet und nur 11 das Formular abgeschickt — und in diesen 11
 * stecken noch eigene Testlaeufe. Wer sechs Antworten gibt, hat seine
 * Einschaetzung verdient; die Kontaktdaten fragen wir danach und fuer
 * etwas anderes: den Abgleich mit Anbietern.
 */
type Phase = 'questions' | 'result' | 'contact' | 'confirmed';

export default function Quiz() {
  const [phase, setPhase] = useState<Phase>('questions');
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Herkunft sofort beim Aufruf sichern, nicht erst beim Absenden: bis der
  // Nutzer das Quiz durch hat, kann die URL laengst ohne Parameter dastehen.
  useEffect(() => {
    captureAttribution();
  }, []);

  // Optionaler Paketkosten-Rechner: nach dem Ergebnis, nicht davor. Er ist
  // nicht mehr die Haupt-Conversion, aber weiterhin das stärkste
  // Gesprächsargument für den Anbieter, der den Lead bekommt.
  const [calcRaw, setCalcRaw] = useState<Record<keyof CostInputs, string>>({ ...EMPTY_COST_INPUTS });
  const [cost, setCost] = useState<CostResult | null>(null);
  /** Pakete/Monat aus den Rechnereingaben — steht nicht im Ergebnisobjekt. */
  const [costParcels, setCostParcels] = useState<number | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcSending, setCalcSending] = useState(false);
  /** CRM-Datensatz des bereits angelegten Leads (HubSpot-Kontakt, waehrend
   *  der Umstellung ggf. noch ein monday-Item) — der Rechner reichert ihn
   *  nach, statt einen zweiten Lead anzulegen. */
  const [itemId, setItemId] = useState<string | null>(null);
  /** Welches CRM den Lead aufgenommen hat — der Nachtrag muss in dieselbe
   *  Datenbank, sonst laeuft eine HubSpot-ID gegen ein monday-Board. */
  const [crm, setCrm] = useState<string | null>(null);

  const totalQuestions = QUESTIONS.length;
  const progressPct =
    phase === 'questions' ? Math.round((qIndex / totalQuestions) * 100) : 100;

  /** "Andere" ist kein Shop-Betreiber — Einschaetzung ja, Vermittlung nein. */
  const notFit = answers.role === 'Andere';

  function updateField(field: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function selectAnswer(key: QuestionKey, value: string) {
    updateField(key, value);
    // QuizStart feuert jetzt bei der ersten beantworteten Frage. Frueher
    // haing es an der Rollenauswahl, die es als Schritt nicht mehr gibt.
    if (!started) {
      track('QuizStart');
      setStarted(true);
    }
    track('QuizQuestionAnswered', { question: key, position: qIndex + 1 });
    setTimeout(() => {
      if (qIndex + 1 < QUESTIONS.length) {
        setQIndex((i) => i + 1);
      } else {
        track('QuizComplete');
        setPhase('result');
      }
    }, 160);
  }

  function goBack() {
    setSubmitError(null);
    setFormErrors({});
    if (phase === 'contact') {
      setPhase('result');
    } else if (phase === 'questions' && qIndex > 0) {
      setQIndex((i) => i - 1);
    }
  }

  function validateContact(): boolean {
    const errors: Record<string, string> = {};
    if (!answers.name.trim()) errors.name = 'Bitte Namen angeben.';
    if (!answers.company.trim()) errors.company = 'Bitte Firma angeben.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) {
      errors.email = 'Bitte gültige E-Mail-Adresse angeben.';
    }
    // Telefon ist bewusst optional. Vier Pflichtfelder am Ende eines
    // B2B-Funnels sind eines zu viel, und die Nummer ist erfahrungsgemaess
    // das Feld, an dem abgebrochen wird. Wer sie freiwillig hinterlaesst,
    // ist der wertvollere Lead — erzwingen macht ihn nicht besser.

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateContact()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...answers, attribution: readAttribution() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler');
      // Ohne itemId liegt nichts im CRM — dann ist es kein Lead, egal was der
      // Statuscode sagt. Ein Lead-Event ohne Eintrag dahinter lässt Meta auf
      // Phantom-Conversions optimieren und zeigt dem Nutzer einen
      // Erfolgsbildschirm für eine Anfrage, die niemanden erreicht hat.
      if (typeof data.itemId !== 'string') {
        throw new Error('Deine Anfrage konnte nicht gespeichert werden. Bitte versuch es gleich nochmal.');
      }
      setItemId(data.itemId);
      setCrm(typeof data.crm === 'string' ? data.crm : null);
      // Meta Lead-Event erst NACH erfolgreichem Absenden feuern — sonst
      // zählt jeder Versuch, nicht nur die eingegangene Anfrage.
      track('Lead');
      setPhase('confirmed');
      // Der Rechner laeuft jetzt VOR der Kontaktabfrage. Wer ihn schon
      // benutzt hat, hat Zahlen, die zu diesem Zeitpunkt noch an keinem
      // CRM-Datensatz haengen — jetzt nachreichen.
      if (cost && costParcels !== null) {
        enrichWithCosts(data.itemId, data.crm ?? null, cost, costParcels);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Da ist etwas schiefgelaufen. Bitte versuch es gleich nochmal.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Traegt die Rechnerwerte an einem bereits angelegten Lead nach.
   * Schlaegt es fehl, ist der Lead trotzdem im CRM — deshalb nur loggen.
   */
  function enrichWithCosts(
    targetId: string,
    targetCrm: string | null,
    result: CostResult,
    parcels: number
  ) {
    setCalcSending(true);
    fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: targetId,
        crm: targetCrm,
        parcelsPerMonth: parcels,
        costPerParcel: result.costPerParcel,
        laborSharePct: result.laborShare * 100,
        fteEquivalent: result.fteEquivalent,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        track('CalculatorCompleted');
      })
      .catch((err) => console.error('Nachtrag der Rechnerwerte fehlgeschlagen', err))
      .finally(() => setCalcSending(false));
  }

  function submitCalc() {
    const errors: Record<string, string> = {};
    const parsed: Partial<CostInputs> = {};

    for (const f of CALC_FIELDS) {
      const n = parseNumber(calcRaw[f.key]);
      if (Number.isNaN(n)) errors[f.key] = 'Bitte eine Zahl eintragen.';
      else if (n < 0) errors[f.key] = 'Bitte keine negative Zahl.';
      else if (n === 0 && !f.allowZero) errors[f.key] = 'Bitte einen Wert größer als null eintragen.';
      else parsed[f.key] = n;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const inputs = parsed as CostInputs;
    const result = calculateCosts(inputs);
    setCost(result);
    setCostParcels(inputs.parcels);

    // Der Rechner ist jetzt ohne Kontaktdaten nutzbar. Existiert noch kein
    // CRM-Datensatz, werden die Werte beim spaeteren Absenden nachgereicht.
    if (itemId) enrichWithCosts(itemId, crm, result, inputs.parcels);
  }

  // ---------- Ergebnis (jetzt VOR der Kontaktabfrage) ----------
  if (phase === 'result' || phase === 'confirmed') {
    const a = buildAssessment({
      role: answers.role,
      volume: answers.volume,
      process: answers.process,
      timeSpent: answers.timeSpent,
      challenge: answers.challenge,
      growth: answers.growth,
      priority: answers.priority,
      name: answers.name,
      company: answers.company,
      email: answers.email,
      phone: answers.phone,
    });
    const firstName = answers.name.trim().split(' ')[0];

    return (
      <div className="quiz-card">
        <p className="step-label">Deine Einschätzung</p>
        <h2 className="result-head">{a.headline}</h2>

        <div className="result-facts">
          <div className="result-fact">
            <span>Bestellungen</span>
            <b>{answers.volume} / Monat</b>
          </div>
          <div className="result-fact">
            <span>Fulfillment</span>
            <b>{answers.process}</b>
          </div>
          <div className="result-fact">
            <span>Zeitaufwand</span>
            <b>{answers.timeSpent}</b>
          </div>
          <div className="result-fact">
            <span>Wachstumsziel</span>
            <b>{answers.growth}</b>
          </div>
        </div>

        <div className={`verdict verdict--${a.signal}`}>
          <p className="verdict-line">{a.verdict}</p>
          <p className="verdict-reason">{a.reasoning}</p>
        </div>

        <div className="result-block">
          <h3>Was du unabhängig von uns prüfen kannst</h3>
          <p>{a.nextStep}</p>
        </div>

        {/* Rechner: ohne Kontaktdaten nutzbar. Er ist der zweite Teil des
            Werts, den der Nutzer fuer seine sechs Antworten bekommt. */}
        {!calcOpen && !cost && (
          <div className="result-block result-block--accent">
            <h3>Optional: eure Ist-Kosten pro Paket</h3>
            <p>
              Fünf Zahlen aus eurem Betrieb, dann seht ihr, was euch die Abwicklung
              heute wirklich kostet — inklusive der Stunden, die in den Gehältern
              stecken. Das ist die ehrlichste Vergleichsgrundlage gegen jedes Angebot.
            </p>
            <button className="btn-primary" onClick={() => setCalcOpen(true)} type="button">
              Paketkosten berechnen →
            </button>
          </div>
        )}

        {calcOpen && !cost && (
          <div className="result-block result-block--accent">
            <h3>Eure Ist-Kosten pro Paket</h3>
            <p className="field-hint">
              Schätzwerte reichen. Porto lassen wir absichtlich weg, das zahlt ihr mit
              und ohne Dienstleister.
            </p>
            {CALC_FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label htmlFor={f.key}>{f.label}</label>
                {f.hint && <span className="field-hint">{f.hint}</span>}
                <div className="calc-input">
                  <input
                    id={f.key}
                    type="text"
                    inputMode="decimal"
                    value={calcRaw[f.key]}
                    onChange={(e) => setCalcRaw((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                  <span className="calc-suffix">{f.suffix}</span>
                </div>
                {formErrors[f.key] && <p className="error-text">{formErrors[f.key]}</p>}
              </div>
            ))}
            <button className="btn-primary" onClick={submitCalc} type="button">
              Ergebnis anzeigen →
            </button>
          </div>
        )}

        {cost && (
          <div className="result-block result-block--accent">
            <h3>Eure Ist-Kosten pro Paket</h3>
            <div className="cost-headline">
              <span className="cost-value">{euro(cost.costPerParcel)}</span>
              <span className="cost-unit">pro Paket, nur Abwicklung</span>
            </div>
            <div className="cost-rows">
              <div className="cost-row">
                <span>Personal</span>
                <b>{euro(cost.laborPerMonth)} / Monat</b>
              </div>
              <div className="cost-row">
                <span>Verpackung</span>
                <b>{euro(cost.packagingPerMonth)} / Monat</b>
              </div>
              <div className="cost-row">
                <span>Lagerfläche</span>
                <b>{euro(cost.rentPerMonth)} / Monat</b>
              </div>
              <div className="cost-row cost-row--total">
                <span>Summe</span>
                <b>{euro(cost.totalPerMonth)} / Monat</b>
              </div>
            </div>
            <p>
              Der Versand bindet bei euch{' '}
              <strong>{formatHours(cost.hoursPerMonth)} Stunden im Monat</strong>, das
              entspricht {cost.fteEquivalent.toFixed(1).replace('.', ',')} Vollzeitstellen.
              Personal macht damit <strong>{Math.round(cost.laborShare * 100)} %</strong> eurer
              Abwicklungskosten aus, also {euro(cost.laborPerParcel)} pro Paket.
            </p>
            <p className="field-hint">
              Reine Arithmetik auf euren Angaben, kein Branchenvergleich.
              {calcSending ? ' Wird übermittelt …' : ''}
            </p>
          </div>
        )}

        {/* Erst jetzt die Gegenleistung — und fuer etwas anderes als das
            Ergebnis, das der Nutzer bereits hat. */}
        {phase === 'result' && !notFit && (
          <div className="result-block result-block--cta">
            <h3>Sollen wir dir passende Anbieter heraussuchen?</h3>
            <p>
              Wir gleichen deine Angaben mit Fulfillment-Anbietern ab, die zu deinem
              Volumen, deiner Warenart und deinem Zeitrahmen passen. Passt keiner,
              meldet sich auch keiner.
            </p>
            <button className="btn-primary" onClick={() => setPhase('contact')} type="button">
              Anbieter abgleichen →
            </button>
            <p className="microcopy">Kostenlos · unverbindlich · kein Termin nötig</p>
          </div>
        )}

        {phase === 'result' && notFit && (
          <div className="result-block">
            <h3>Die Vermittlung ist für Shop-Betreiber gemacht</h3>
            <p>
              Deine Einschätzung steht oben und gehört dir. Die Anbieter-Vermittlung
              richtet sich an Inhaber und Betriebsverantwortliche eines Online-Shops
              mit eigenem Versand — deshalb bieten wir sie dir hier nicht an.
            </p>
          </div>
        )}

        {phase === 'confirmed' && (
          <div className="result-followup">
            <p>
              <strong>Wie es jetzt weitergeht{firstName ? `, ${firstName}` : ''}:</strong>{' '}
              Wir gleichen die Angaben zu {answers.company} mit Fulfillment-Anbietern ab,
              die zu eurem Volumen, eurer Warenart und eurem Zeitrahmen passen. Passt es,
              meldet sich der Anbieter direkt bei euch. {a.followUp}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ---------- Fragen + Kontakt ----------
  return (
    <div className="quiz-card">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {phase === 'questions' && (
        <div>
          <p className="step-label">
            Frage {qIndex + 1} von {totalQuestions}
          </p>
          <h2>{QUESTIONS[qIndex].question}</h2>
          <div className="options">
            {QUESTIONS[qIndex].options.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`option-btn${answers[QUESTIONS[qIndex].key] === opt ? ' selected' : ''}`}
                onClick={() => selectAnswer(QUESTIONS[qIndex].key, opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          {qIndex > 0 && (
            <div className="nav-row">
              <button className="btn-ghost" onClick={goBack} type="button">
                Zurück
              </button>
              <span />
            </div>
          )}
        </div>
      )}

      {phase === 'contact' && (
        <div>
          <p className="step-label">Anbieter-Abgleich</p>
          <h2>Wohin dürfen wir die passenden Anbieter schicken?</h2>
          <p>
            Deine Einschätzung hast du bereits. Diese Angaben brauchen wir nur, um dich
            mit Anbietern abzugleichen, die zu deinem Volumen und deiner Warenart passen.
          </p>

          <div className="field">
            <label htmlFor="name">Vorname</label>
            <input
              id="name"
              value={answers.name}
              onChange={(e) => updateField('name', e.target.value)}
              autoComplete="given-name"
            />
            {formErrors.name && <p className="error-text">{formErrors.name}</p>}
          </div>

          <div className="field">
            <label htmlFor="company">Firma</label>
            <input
              id="company"
              value={answers.company}
              onChange={(e) => updateField('company', e.target.value)}
              autoComplete="organization"
            />
            {formErrors.company && <p className="error-text">{formErrors.company}</p>}
          </div>

          <div className="field">
            <label htmlFor="email">E-Mail</label>
            <input
              id="email"
              type="email"
              value={answers.email}
              onChange={(e) => updateField('email', e.target.value)}
              autoComplete="email"
            />
            {formErrors.email && <p className="error-text">{formErrors.email}</p>}
          </div>

          <div className="field">
            <label htmlFor="phone">
              Telefon <span className="optional-label">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={answers.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              autoComplete="tel"
            />
            {formErrors.phone && <p className="error-text">{formErrors.phone}</p>}
          </div>

          <div className="field">
            <label htmlFor="shopUrl">
              Shoplink <span className="optional-label">(optional)</span>
            </label>
            <input
              id="shopUrl"
              type="url"
              placeholder="https://dein-shop.de"
              value={answers.shopUrl}
              onChange={(e) => updateField('shopUrl', e.target.value)}
              autoComplete="url"
            />
          </div>

          {/* Honeypot — für Menschen unsichtbar (.honeypot in globals.css).
              Der Feldname trägt bewusst keine URL-Semantik mehr: Ein Feld
              namens "website" direkt neben dem sichtbaren Shoplink-Feld wird
              von Passwortmanagern und Browser-Autofill befüllt, die
              autoComplete="off" schlicht ignorieren. Genau das hat am 11.09.
              zwei echte Anfragen gekostet, bevor der Server sie nicht mehr
              still verworfen hat. */}
          <div className="honeypot" aria-hidden="true">
            <label htmlFor="contact-reference">Referenz</label>
            <input
              id="contact-reference"
              name="contact-reference"
              tabIndex={-1}
              autoComplete="off"
              value={answers.contactReference}
              onChange={(e) => updateField('contactReference', e.target.value)}
            />
          </div>

          {submitError && <p className="error-text">{submitError}</p>}

          {/* Kein Datenschutz-Hinweis ist hier keine Option: die Nummer geht
              an einen Anbieter, der anruft — Telefonwerbung ohne vorherige
              Einwilligung ist nach § 7 UWG abmahnfähig, und die Offenlegung
              bei Weitergabe an Dritte verlangt Art. 13 DSGVO. */}
          <p className="privacy-note">
            Passt Auslagern zu deinem Shop, verbinden wir dich mit einem passenden
            Anbieter.{' '}
            <a href="/datenschutz" target="_blank" rel="noopener noreferrer">
              Datenschutz
            </a>
            .
          </p>

          <div className="nav-row">
            <button className="btn-ghost" onClick={goBack} type="button">
              Zurück
            </button>
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting} type="button">
              {submitting ? 'Wird gesendet …' : 'Anbieter abgleichen →'}
            </button>
          </div>
          <p className="microcopy">Kostenlos · unverbindlich · kein Spam</p>
        </div>
      )}
    </div>
  );
}
