'use client';

import { useState } from 'react';

type Answers = {
  segment: string;
  volume: string;
  situation: string;
  challenge: string;
  urgency: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string; // honeypot
};

const EMPTY_ANSWERS: Answers = {
  segment: '',
  volume: '',
  situation: '',
  challenge: '',
  urgency: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  website: '',
};

type ChoiceStep = {
  key: 'segment' | 'volume' | 'situation' | 'challenge' | 'urgency';
  label: string;
  question: string;
  options: string[];
};

const CHOICE_STEPS: ChoiceStep[] = [
  {
    key: 'segment',
    label: 'Schritt 1 von 6',
    question: 'Was beschreibt euer Unternehmen am besten?',
    options: [
      'E-Commerce & Online-Handel',
      'Marke mit Lagerbedarf',
      'Multichannel-Anbieter',
      'Sonstiges',
    ],
  },
  {
    key: 'volume',
    label: 'Schritt 2 von 6',
    question: 'Wie viele Sendungen verschickt ihr aktuell pro Monat?',
    options: ['Unter 100', '100–500', '500–2.000', 'Über 2.000'],
  },
  {
    key: 'situation',
    label: 'Schritt 3 von 6',
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
    label: 'Schritt 4 von 6',
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
    label: 'Schritt 5 von 6',
    question: 'Wie dringend sucht ihr eine Lösung?',
    options: ['Akut — wir suchen jetzt', 'In den nächsten 1–3 Monaten', 'Explorativ, wir informieren uns'],
  },
];

const TOTAL_STEPS = CHOICE_STEPS.length + 1; // + Kontakt-Schritt

export default function Quiz() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

  function validateContact(): boolean {
    const errors: Record<string, string> = {};
    if (!answers.name.trim()) errors.name = 'Bitte Namen angeben.';
    if (!answers.company.trim()) errors.company = 'Bitte Firma angeben.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) {
      errors.email = 'Bitte gültige E-Mail-Adresse angeben.';
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
        body: JSON.stringify(answers),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Unbekannter Fehler');
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
    return (
      <div className="quiz-card">
        <div className="result">
          <div className="result-icon" aria-hidden="true">✓</div>
          <h2>Danke, {answers.name.split(' ')[0] || ''}!</h2>
          <p>
            Wir haben deine Angaben zu <strong>{answers.company}</strong> erhalten und
            melden uns in Kürze mit einer passenden Einschätzung für euer Fulfillment.
          </p>
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
          selected={answers[CHOICE_STEPS[stepIndex].key]}
          onSelect={(value) => selectChoice(CHOICE_STEPS[stepIndex].key, value)}
          onBack={stepIndex > 0 ? goBack : undefined}
        />
      )}

      {isContactStep && (
        <div>
          <p className="step-label">Schritt 6 von 6</p>
          <h2>Wohin dürfen wir uns melden?</h2>

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
            <label htmlFor="phone">Telefon (optional)</label>
            <input
              id="phone"
              type="tel"
              value={answers.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              autoComplete="tel"
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
              {submitting ? 'Wird gesendet …' : 'Absenden'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceStepView({
  step,
  selected,
  onSelect,
  onBack,
}: {
  step: ChoiceStep;
  selected: string;
  onSelect: (value: string) => void;
  onBack?: () => void;
}) {
  return (
    <div>
      <p className="step-label">{step.label}</p>
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
