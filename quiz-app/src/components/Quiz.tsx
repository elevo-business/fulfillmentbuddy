'use client';

import { useState } from 'react';
import { buildAssessment } from '@/lib/assessment';

type Answers = {
  volume: string;
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
  volume: '',
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
  key: 'volume' | 'storage' | 'situation' | 'challenge' | 'urgency';
  question: string;
  options: string[];
};

const CHOICE_STEPS: ChoiceStep[] = [
  {
    key: 'volume',
    question: 'Wie viele Sendungen verschickt ihr aktuell pro Monat?',
    options: ['Unter 500', '500–1.000', '1.000–2.000', '2.000+'],
  },
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

const TOTAL_STEPS = CHOICE_STEPS.length + 1; // + Kontakt-Schritt

export default function Quiz() {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Telefon-Verifizierung per SMS-OTP (Twilio Verify). PFLICHT fürs
  // Absenden (validateContact() prüft phoneVerified) — der Submit-Button
  // ist zusätzlich deaktiviert, solange nicht verifiziert wurde.
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpChecking, setOtpChecking] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const isContactStep = stepIndex === CHOICE_STEPS.length;
  const progressPct = done
    ? 100
    : Math.round((stepIndex / TOTAL_STEPS) * 100);

  function selectChoice(key: ChoiceStep['key'], value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setTimeout(() => setStepIndex((i) => i + 1), 180);
  }

  function goBack() {
    setSubmitError(null);
    setStepIndex((i) => Math.max(0, i - 1));
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
    } else if (!phoneVerified) {
      errors.phone = 'Bitte Telefonnummer erst per SMS-Code bestätigen.';
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
        body: JSON.stringify({ ...answers, phoneVerified }),
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
      volume: answers.volume,
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

  if (!started) {
    return (
      <div className="quiz-card">
        <div className="intro">
          <p className="step-label">Fulfillment-Partner finden</p>
          <h2>Welcher Fulfillment-Anbieter passt zu eurem Volumen?</h2>
          <p className="intro-sub">
            {CHOICE_STEPS.length} Fragen zu eurem Setup. Auf dieser Basis gleichen wir
            eure Anforderungen mit Fulfillment-Anbietern ab — passt es, meldet sich
            der Anbieter direkt bei euch.
          </p>
          <ul className="intro-perks">
            <li><span aria-hidden="true">⏱️</span> 2 Minuten statt wochenlanger Anbieter-Recherche</li>
            <li><span aria-hidden="true">🎯</span> Vorauswahl nach Volumen, Warenart und Zeitrahmen</li>
            <li><span aria-hidden="true">🔒</span> Unverbindlich — ihr entscheidet, mit wem ihr sprecht</li>
          </ul>
          <button className="btn-primary btn-start" onClick={() => setStarted(true)} type="button">
            Passende Anbieter finden →
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

      {!isContactStep && (
        <ChoiceStepView
          step={CHOICE_STEPS[stepIndex]}
          stepIndex={stepIndex}
          selected={answers[CHOICE_STEPS[stepIndex].key]}
          onSelect={(value) => selectChoice(CHOICE_STEPS[stepIndex].key, value)}
          onBack={stepIndex > 0 ? goBack : undefined}
        />
      )}

      {isContactStep && (
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
                    {otpSending ? 'Code wird gesendet …' : 'Nummer per SMS bestätigen'}
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
              disabled={submitting || !phoneVerified}
              title={!phoneVerified ? 'Bitte zuerst Telefonnummer per SMS bestätigen.' : undefined}
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
  stepIndex,
  selected,
  onSelect,
  onBack,
}: {
  step: ChoiceStep;
  stepIndex: number;
  selected: string;
  onSelect: (value: string) => void;
  onBack?: () => void;
}) {
  return (
    <div>
      <p className="step-label">Schritt {stepIndex + 1} von {TOTAL_STEPS}</p>
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
      {onBack && (
        <div className="nav-row">
          <button className="btn-ghost" onClick={onBack} type="button">
            Zurück
          </button>
          <span />
        </div>
      )}
    </div>
  );
}
