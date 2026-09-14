'use client';

import { useState } from 'react';
import { buildAssessment } from '@/lib/assessment';
import {
  calculateCosts,
  parseNumber,
  volumeBracket,
  euro,
  formatHours,
  EMPTY_COST_INPUTS,
  type CostInputs,
  type CostResult,
} from '@/lib/costCalc';

type Answers = {
  role: string;
  storage: string;
  situation: string;
  challenge: string;
  urgency: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  shopUrl: string;
  website: string; // honeypot
};

const EMPTY_ANSWERS: Answers = {
  role: '',
  storage: '',
  situation: '',
  challenge: '',
  urgency: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  shopUrl: '',
  website: '',
};

type ChoiceStep = {
  key: 'storage' | 'situation' | 'challenge' | 'urgency';
  question: string;
  options: string[];
};

// Rollenfrage: eigene Phase ('gate'), nicht Teil von CHOICE_STEPS, mit
// eigenem State statt dem generischen ChoiceStep-Mechanismus (sie steuert
// eine Weiche, kein normaler Fragenschritt). Zwei der drei aktuell
// laufenden Ad-Creatives versprechen allgemeine "Fulfillment
// auslagern"-Hilfe statt konkret den Rechner — dadurch ist der eingehende
// Traffic breiter/weniger vorqualifiziert als in der ersten Runde. Die
// Rollenfrage steht deshalb VOR dem Rechner (statt wie vorher danach):
// ein Klick filtert Job-Interessenten und Neugierige raus, bevor sie fünf
// Felder ausfüllen — schont ihre Zeit und hält die Rechner-
// Completion-Rate als Kennzahl aussagekräftig.
const ROLE_OPTIONS = ['Inhaber / Geschäftsführung', 'Betrieb / Logistik', 'Andere'];

const CHOICE_STEPS: ChoiceStep[] = [
  {
    key: 'storage',
    question: 'Wie hoch ist euer durchschnittlicher Lagerbedarf in Paletten pro Monat?',
    options: ['0–10', '10–20', '30–50', '50+', 'Nicht sicher'],
  },
  {
    key: 'situation',
    question: 'Wie läuft euer Fulfillment aktuell?',
    options: [
      'Inhouse / selbst',
      'Dienstleister vorhanden, aber unzufrieden',
      'Noch kein Fulfillment-Partner',
      'Wachstum übersteigt aktuelle Kapazität',
    ],
  },
  {
    key: 'challenge',
    question: 'Was ist aktuell eure größte Herausforderung?',
    options: [
      'Steigende Fehlerquote & Retouren',
      'Lagerkapazität am Limit',
      'Saisonale Spitzen (z. B. Black Friday)',
      'Lieferzeiten & Kundenerwartung',
      'Intransparente Kosten',
    ],
  },
  {
    key: 'urgency',
    question: 'Wie dringend sucht ihr eine Lösung?',
    options: ['Akut — wir suchen jetzt', 'In den nächsten 1–3 Monaten', 'Explorativ, wir informieren uns'],
  },
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

// Gate (Rolle), Rechner, Ergebnis, Auswahlfragen, Kontakt
const TOTAL_STEPS = 3 + CHOICE_STEPS.length + 1;

type Phase = 'intro' | 'gate' | 'notFit' | 'calc' | 'result' | 'choices' | 'contact';

export default function Quiz() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [calcRaw, setCalcRaw] = useState<Record<keyof CostInputs, string>>({ ...EMPTY_COST_INPUTS });
  const [cost, setCost] = useState<CostResult | null>(null);
  const [parcels, setParcels] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Telefon-Verifizierung per SMS-OTP (Twilio Verify). Aktuell OPTIONAL:
  // die Pflicht war die wahrscheinlichste Ursache dafür, dass von 266
  // Ad-Klicks kein einziges Formular abgeschickt wurde. Wer bestätigt,
  // wird als verifiziert ans CRM übergeben (phoneVerified) und ist damit
  // im Lead-Scoring unterscheidbar.
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpChecking, setOtpChecking] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const stepNumber =
    phase === 'gate'
      ? 1
      : phase === 'calc'
        ? 2
        : phase === 'result'
          ? 3
          : phase === 'choices'
            ? 4 + choiceIndex
            : TOTAL_STEPS;
  const progressPct = done ? 100 : Math.round(((stepNumber - 1) / TOTAL_STEPS) * 100);

  function selectRole(value: string) {
    updateField('role', value);
    setTimeout(() => {
      setPhase(value === 'Andere' ? 'notFit' : 'calc');
    }, 180);
  }

  function updateCalc(key: keyof CostInputs, value: string) {
    setCalcRaw((prev) => ({ ...prev, [key]: value }));
  }

  function submitCalc() {
    const errors: Record<string, string> = {};
    const parsed: Partial<CostInputs> = {};

    for (const f of CALC_FIELDS) {
      const n = parseNumber(calcRaw[f.key]);
      if (Number.isNaN(n)) {
        errors[f.key] = 'Bitte eine Zahl eintragen.';
      } else if (n < 0) {
        errors[f.key] = 'Bitte keine negative Zahl.';
      } else if (n === 0 && !f.allowZero) {
        errors[f.key] = 'Bitte einen Wert größer als null eintragen.';
      } else {
        parsed[f.key] = n;
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const inputs = parsed as CostInputs;
    setParcels(inputs.parcels);
    setCost(calculateCosts(inputs));
    setPhase('result');
  }

  function selectChoice(key: ChoiceStep['key'], value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setTimeout(() => {
      if (choiceIndex + 1 < CHOICE_STEPS.length) {
        setChoiceIndex((i) => i + 1);
      } else {
        setPhase('contact');
      }
    }, 180);
  }

  function goBack() {
    setSubmitError(null);
    setFormErrors({});
    if (phase === 'contact') {
      setPhase('choices');
      setChoiceIndex(CHOICE_STEPS.length - 1);
    } else if (phase === 'choices') {
      if (choiceIndex > 0) setChoiceIndex((i) => i - 1);
      else setPhase('result');
    } else if (phase === 'result') {
      setPhase('calc');
    } else if (phase === 'calc') {
      setPhase('gate');
    }
  }

  function updateField(field: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function updatePhone(value: string) {
    updateField('phone', value);
    // Neue Nummer eingetippt -> vorherige Verifizierung ist hinfällig.
    setPhoneVerified(false);
    setOtpSent(false);
    setOtpCode('');
    setOtpError(null);
  }

  async function sendOtp() {
    if (!answers.phone.trim()) {
      setFormErrors((prev) => ({ ...prev, phone: 'Bitte zuerst Telefonnummer angeben.' }));
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: answers.phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Code konnte nicht gesendet werden.');
      setOtpSent(true);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Code konnte nicht gesendet werden.');
    } finally {
      setOtpSending(false);
    }
  }

  async function checkOtp() {
    if (!otpCode.trim()) {
      setOtpError('Bitte Code eingeben.');
      return;
    }
    setOtpChecking(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: answers.phone, code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Prüfung fehlgeschlagen.');
      if (data.verified) {
        setPhoneVerified(true);
      } else {
        setOtpError('Code stimmt nicht. Bitte prüfen und nochmal versuchen.');
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Prüfung fehlgeschlagen.');
    } finally {
      setOtpChecking(false);
    }
  }

  function validateContact(): boolean {
    const errors: Record<string, string> = {};
    if (!answers.name.trim()) errors.name = 'Bitte Namen angeben.';
    if (!answers.company.trim()) errors.company = 'Bitte Firma angeben.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) {
      errors.email = 'Bitte gültige E-Mail-Adresse angeben.';
    }
    if (!answers.phone.trim()) {
      errors.phone = 'Bitte Telefonnummer angeben.';
    }
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
        body: JSON.stringify({
          ...answers,
          // volume wird aus der Paketzahl des Rechners abgeleitet und nicht
          // mehr separat abgefragt.
          volume: volumeBracket(parcels),
          phoneVerified,
          parcelsPerMonth: parcels,
          costPerParcel: cost?.costPerParcel,
          laborSharePct: cost ? cost.laborShare * 100 : undefined,
          fteEquivalent: cost?.fteEquivalent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Unbekannter Fehler');
      }
      // Meta Lead-Event erst NACH erfolgreichem Absenden feuern — sonst
      // zählt jeder Versuch, nicht nur die tatsächlich eingegangene Anfrage.
      if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'Lead');
      }
      setDone(true);
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

  if (done) {
    const a = buildAssessment({
      volume: volumeBracket(parcels),
      role: answers.role,
      storage: answers.storage,
      situation: answers.situation,
      challenge: answers.challenge,
      urgency: answers.urgency,
      name: answers.name,
      company: answers.company,
      email: answers.email,
      phone: answers.phone,
    });
    const firstName = answers.name.trim().split(' ')[0];

    return (
      <div className="quiz-card">
        <p className="step-label">Anfrage ist raus</p>
        <h2 className="result-head">
          Danke{firstName ? `, ${firstName}` : ''}. Hier schon mal, wie wir eure
          Angaben lesen:
        </h2>

        {cost && (
          <div className="result-block">
            <h3>Eure gerechneten Ist-Kosten</h3>
            <p>
              <strong>{euro(cost.costPerParcel)} pro Paket</strong>, davon{' '}
              {euro(cost.laborPerParcel)} Personal.
            </p>
          </div>
        )}

        <div className="result-block">
          <h3>Größenordnung</h3>
          <p>{a.scale}</p>
          {a.storage && <p>{a.storage}</p>}
        </div>

        <div className="result-block">
          <h3>Eure Ausgangslage</h3>
          <p>{a.situation}</p>
        </div>

        <div className="result-block result-block--accent">
          <h3>Der nächste konkrete Schritt</h3>
          <p>{a.nextStep}</p>
        </div>

        <div className="result-followup">
          <p>
            <strong>Wie es jetzt weitergeht:</strong> Wir gleichen die Angaben zu{' '}
            {answers.company} mit Fulfillment-Anbietern ab, die zu eurem Volumen,
            eurer Warenart und eurem Zeitrahmen passen. Passt es, meldet sich der
            Anbieter direkt bei euch. {a.followUp}
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="quiz-card">
        <div className="intro">
          <p className="step-label">Fulfillment auslagern</p>
          <h2>Bevor wir euch mit einem Anbieter verbinden: eure Zahlen.</h2>
          <p className="intro-sub">
            Fünf Angaben aus eurem Betrieb, dann seht ihr eure Ist-Kosten pro Paket —
            inklusive der Stunden, die in keiner Kalkulation stehen, weil sie in den
            Gehältern stecken. Auf dieser Basis gleichen wir euch mit passenden
            Fulfillment-Anbietern ab.
          </p>
          <ul className="intro-perks">
            <li><span aria-hidden="true">🧮</span> Eure eigenen Zahlen, keine Branchendurchschnitte</li>
            <li><span aria-hidden="true">👀</span> Ergebnis direkt sichtbar, ohne E-Mail vorher</li>
            <li><span aria-hidden="true">🔒</span> Unverbindlich, ihr entscheidet, mit wem ihr sprecht</li>
          </ul>
          <button className="btn-primary btn-start" onClick={() => setPhase('gate')} type="button">
            Los geht's →
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'notFit') {
    return (
      <div className="quiz-card">
        <div className="intro">
          <p className="step-label">Kurz gecheckt</p>
          <h2>Das hier ist für Shop-Betreiber gemacht</h2>
          <p className="intro-sub">
            Der Rechner und die Anbieter-Vermittlung richten sich an Inhaber und
            Betriebsverantwortliche eines Online-Shops mit eigenem Versand. Das
            scheint bei euch aktuell nicht zu passen — schaut gerne auf{' '}
            <a href="/">fulfillmentbuddy.de</a> vorbei, falls sich das ändert.
          </p>
          <button className="btn-ghost" onClick={() => setPhase('gate')} type="button">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-card">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {phase === 'gate' && (
        <div>
          <p className="step-label">Schritt 1 von {TOTAL_STEPS}</p>
          <h2>Welche Rolle hast du im Unternehmen?</h2>
          <div className="options">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`option-btn${answers.role === opt ? ' selected' : ''}`}
                onClick={() => selectRole(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="nav-row">
            <button className="btn-ghost" onClick={() => setPhase('intro')} type="button">
              Zurück
            </button>
            <span />
          </div>
        </div>
      )}

      {phase === 'calc' && (
        <div>
          <p className="step-label">Schritt 2 von {TOTAL_STEPS}</p>
          <h2>Eure Zahlen</h2>
          <p className="intro-sub">
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
                  onChange={(e) => updateCalc(f.key, e.target.value)}
                />
                <span className="calc-suffix">{f.suffix}</span>
              </div>
              {formErrors[f.key] && <p className="error-text">{formErrors[f.key]}</p>}
            </div>
          ))}

          <div className="nav-row">
            <button className="btn-ghost" onClick={() => setPhase('gate')} type="button">
              Zurück
            </button>
            <button className="btn-primary" onClick={submitCalc} type="button">
              Ergebnis anzeigen →
            </button>
          </div>
        </div>
      )}

      {phase === 'result' && cost && (
        <div>
          <p className="step-label">Schritt 3 von {TOTAL_STEPS}</p>
          <h2>Euer Ist-Wert</h2>

          <div className="cost-headline">
            <span className="cost-value">{euro(cost.costPerParcel)}</span>
            <span className="cost-unit">pro Paket, nur Abwicklung</span>
          </div>

          <div className="result-block">
            <h3>Woraus sich das zusammensetzt</h3>
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
          </div>

          <div className="result-block result-block--accent">
            <h3>Die Zeile, die meist fehlt</h3>
            <p>
              Der Versand bindet bei euch{' '}
              <strong>{formatHours(cost.hoursPerMonth)} Stunden im Monat</strong>, das
              entspricht {cost.fteEquivalent.toFixed(1).replace('.', ',')} Vollzeitstellen.
              Personal macht damit{' '}
              <strong>{Math.round(cost.laborShare * 100)} %</strong> eurer Abwicklungskosten
              aus, also {euro(cost.laborPerParcel)} pro Paket.
            </p>
          </div>

          <p className="privacy-note">
            Das ist reine Arithmetik auf euren Angaben, kein Branchenvergleich. Ob ein
            Dienstleister günstiger ist, hängt an seinem Angebot, nicht an dieser Zahl.
          </p>

          <div className="nav-row">
            <button className="btn-ghost" onClick={goBack} type="button">
              Zahlen ändern
            </button>
            <button className="btn-primary" onClick={() => setPhase('choices')} type="button">
              Passende Anbieter finden →
            </button>
          </div>
        </div>
      )}

      {phase === 'choices' && (
        <ChoiceStepView
          step={CHOICE_STEPS[choiceIndex]}
          stepNumber={stepNumber}
          totalSteps={TOTAL_STEPS}
          selected={answers[CHOICE_STEPS[choiceIndex].key]}
          onSelect={(value) => selectChoice(CHOICE_STEPS[choiceIndex].key, value)}
          onBack={goBack}
        />
      )}

      {phase === 'contact' && (
        <div>
          <p className="step-label">Schritt {TOTAL_STEPS} von {TOTAL_STEPS}</p>
          <h2>Wohin soll sich der passende Anbieter melden?</h2>

          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={answers.name}
              onChange={(e) => updateField('name', e.target.value)}
              autoComplete="name"
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
            <label htmlFor="phone">Telefon</label>
            <input
              id="phone"
              type="tel"
              value={answers.phone}
              onChange={(e) => updatePhone(e.target.value)}
              autoComplete="tel"
              required
            />
            {formErrors.phone && <p className="error-text">{formErrors.phone}</p>}

            {phoneVerified ? (
              <p className="otp-success">✓ Nummer bestätigt</p>
            ) : (
              <div className="otp-row">
                {!otpSent ? (
                  <button type="button" className="btn-ghost otp-btn" onClick={sendOtp} disabled={otpSending}>
                    {otpSending ? 'Code wird gesendet …' : 'Nummer per SMS bestätigen (optional)'}
                  </button>
                ) : (
                  <div className="otp-check">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Code aus SMS"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="otp-input"
                    />
                    <button type="button" className="btn-ghost otp-btn" onClick={checkOtp} disabled={otpChecking}>
                      {otpChecking ? 'Prüfe …' : 'Bestätigen'}
                    </button>
                    <button type="button" className="btn-ghost otp-resend" onClick={sendOtp} disabled={otpSending}>
                      Neu senden
                    </button>
                  </div>
                )}
                {otpError && <p className="error-text">{otpError}</p>}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="shopUrl">Shoplink <span className="optional-label">(optional)</span></label>
            <input
              id="shopUrl"
              type="url"
              placeholder="https://euer-shop.de"
              value={answers.shopUrl}
              onChange={(e) => updateField('shopUrl', e.target.value)}
              autoComplete="url"
            />
          </div>

          {/* Honeypot — für Menschen unsichtbar, Bots füllen es oft trotzdem aus */}
          <div className="honeypot" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={answers.website}
              onChange={(e) => updateField('website', e.target.value)}
            />
          </div>

          {submitError && <p className="error-text">{submitError}</p>}

          <p className="privacy-note">
            Mit dem Absenden willigt ihr ein, dass wir eure Angaben an passende
            Fulfillment-Anbieter weitergeben, damit diese euch kontaktieren können.
            Details in der <a href="/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a>.
          </p>

          <div className="nav-row">
            <button className="btn-ghost" onClick={goBack} type="button">
              Zurück
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
              type="button"
            >
              {submitting ? 'Wird gesendet …' : 'Anfrage abschicken'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceStepView({
  step,
  stepNumber,
  totalSteps,
  selected,
  onSelect,
  onBack,
}: {
  step: ChoiceStep;
  stepNumber: number;
  totalSteps: number;
  selected: string;
  onSelect: (value: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <p className="step-label">Schritt {stepNumber} von {totalSteps}</p>
      <h2>{step.question}</h2>
      <div className="options">
        {step.options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`option-btn${selected === opt ? ' selected' : ''}`}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="nav-row">
        <button className="btn-ghost" onClick={onBack} type="button">
          Zurück
        </button>
        <span />
      </div>
    </div>
  );
}
