'use client';

import { useEffect, useState } from 'react';
import Quiz from './Quiz';
import { track } from '@/lib/tracking';

/**
 * Zwei Hero-Varianten für den A/B-Test (Brief §21). Gesteuert über ?v=b
 * in der Ziel-URL der Anzeige, damit pro Creative eine Variante getestet
 * werden kann, ohne zwei Seiten zu pflegen. Default ist A (Pain).
 */
const HERO_VARIANTS = {
  a: {
    headline: 'Packst du noch deine Pakete selbst?',
    sub: 'Finde in 60 Sekunden heraus, ob sich das Fulfillment deines Online-Shops bereits sinnvoll auslagern lässt.',
    cta: 'Fulfillment-Potenzial prüfen →',
  },
  b: {
    headline: 'Dein Shop soll wachsen. Nicht dein Lager.',
    sub: 'Finde heraus, ob dein aktuelles Fulfillment dein nächstes Wachstums-Limit ist.',
    cta: 'Wachstums-Check starten →',
  },
} as const;

const PAINS = [
  {
    title: 'Lagerfläche',
    body: 'Mehr Bestand heißt mehr Platz heißt höhere Fixkosten. Und Fläche lässt sich nicht monatsweise zurückgeben.',
  },
  {
    title: 'Personal',
    body: 'Bestellungen müssen jeden Tag raus, unabhängig davon, worauf dein Team eigentlich fokussiert sein sollte.',
  },
  {
    title: 'Zeit',
    body: 'Stunden gehen für Packen, Labeln, Versand und Retouren drauf. Sie stecken in Gehältern und tauchen pro Paket nie auf.',
  },
  {
    title: 'Skalierung',
    body: 'Mehr Umsatz sollte nicht automatisch mehr operative Arbeit bedeuten. Genau das passiert aber inhouse fast immer.',
  },
];

const CHECK_POINTS = [
  { n: '01', title: 'Bestellvolumen', body: 'Dein tatsächliches Versandvolumen pro Monat.' },
  { n: '02', title: 'Aktueller Prozess', body: 'Wie dein Fulfillment heute organisiert ist.' },
  { n: '03', title: 'Aufwand', body: 'Wie viel Zeit und Personal dafür gebunden werden.' },
  { n: '04', title: 'Wachstum', body: 'Wie stark dein Shop in Zukunft skalieren soll.' },
];

const OBJECTIONS = [
  {
    q: 'Ich habe noch nicht genug Bestellungen.',
    a: 'Möglich. Ab wann es sich rechnet, hängt nicht nur am Volumen, sondern auch am Aufwand pro Bestellung und an deinem Wachstumsziel. Genau das schaut sich der Check an, statt es pauschal zu behaupten.',
  },
  {
    q: 'Ich habe bereits Mitarbeiter dafür.',
    a: 'Die Frage ist nicht, ob jemand packen kann, sondern ob dauerhaft Personal an operativer Versandarbeit gebunden sein soll, während es an anderer Stelle fehlt.',
  },
  {
    q: 'Outsourcing ist bestimmt teurer.',
    a: 'Kann sein. Seriös vergleichen lässt es sich nur, wenn du nicht nur den Paketpreis betrachtest, sondern auch Zeit, Personal, Lagerfläche, Fehlerkosten und Skalierungsaufwand. Wir behaupten nicht, dass Auslagern immer günstiger ist.',
  },
];

export default function LandingPage() {
  const [variant, setVariant] = useState<'a' | 'b'>('a');

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('v');
    if (v === 'b') setVariant('b');
  }, []);

  const hero = HERO_VARIANTS[variant];

  function scrollToCheck() {
    track('CheckCtaClicked', { variant });
    document.getElementById('check')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="lp">
      {/* ---------- HERO ---------- */}
      {/* Bild-Slot: Ein eigenes Creative als CSS-Hintergrund auf .lp-hero
          legen (public/assets/img/hero.webp, dann background-image in
          globals.css setzen). Bewusst kein Stockfoto im Repo. */}
      <section className="lp-hero">
        <div className="lp-inner">
          <p className="eyebrow">Fulfillmentbuddy</p>
          <h1>{hero.headline}</h1>
          <p className="lead">{hero.sub}</p>
          <button className="btn-cta" onClick={scrollToCheck} type="button">
            {hero.cta}
          </button>
          <p className="microcopy">Kostenlos · 60 Sekunden · Unverbindlich</p>
        </div>
      </section>

      {/* ---------- QUALIFIZIERUNG ---------- */}
      <section className="lp-section">
        <div className="lp-inner lp-inner--narrow">
          <h2>Für wen ist der Check gedacht?</h2>
          <p className="lead">Dein Shop …</p>
          <ul className="tick-list">
            <li>verschickt bereits regelmäßig Bestellungen</li>
            <li>wächst oder soll weiter wachsen</li>
            <li>lagert und versendet aktuell selbst</li>
            <li>möchte operative Arbeit reduzieren</li>
            <li>möchte sich stärker auf Wachstum konzentrieren</li>
          </ul>
          <p className="statement-sm">Wenn du dich hier wiedererkennst, ist der Check für dich.</p>
        </div>
      </section>

      {/* ---------- PAIN ---------- */}
      <section className="lp-section lp-section--alt">
        <div className="lp-inner">
          <h2>
            Das Problem ist nicht das Paket.
            <br />
            <span className="accent">Das Problem ist alles, was dahinter steckt.</span>
          </h2>
          <div className="card-grid">
            {PAINS.map((p) => (
              <div className="pain-card" key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
          <p className="statement">Dein Shop sollte skalieren. Nicht dein Lager.</p>
        </div>
      </section>

      {/* ---------- CHECK-POSITIONIERUNG ---------- */}
      <section className="lp-section">
        <div className="lp-inner">
          <h2>Ist dein Shop bereit für ausgelagertes Fulfillment?</h2>
          <p className="lead">
            Beantworte 6 kurze Fragen zu deinem aktuellen Fulfillment. Danach erhältst du
            eine erste Einschätzung, ob Outsourcing für deinen Shop bereits sinnvoll sein
            könnte.
          </p>
          <div className="card-grid">
            {CHECK_POINTS.map((c) => (
              <div className="step-card" key={c.n}>
                <span className="step-num">{c.n}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- QUIZ ---------- */}
      <section className="lp-section lp-section--check" id="check">
        <div className="lp-inner lp-inner--narrow">
          <Quiz />
        </div>
      </section>

      {/* ---------- EINWÄNDE ---------- */}
      <section className="lp-section">
        <div className="lp-inner lp-inner--narrow">
          <h2>„Aber lohnt sich Auslagern für meinen Shop überhaupt?"</h2>
          <p className="lead">
            Das hängt von deinem Bestellvolumen, deinem aktuellen Aufwand, deiner
            Lagerstruktur und deinen Wachstumszielen ab. Genau deshalb gibt es den Check.
          </p>
          <div className="faq">
            {OBJECTIONS.map((o) => (
              <div className="faq-item" key={o.q}>
                <h3>{o.q}</h3>
                <p>{o.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- TRANSPARENZ ---------- */}
      {/* Bewusst keine Kundenlogos, Testimonials oder Zahlen: es gibt noch
          keine echten. Stattdessen Transparenz über das Modell — das ist
          prüfbar und unterscheidet uns von Anbietern, die sich selbst
          bewerben. */}
      <section className="lp-section lp-section--alt">
        <div className="lp-inner">
          <h2>Wie Fulfillmentbuddy arbeitet</h2>
          <div className="card-grid card-grid--3">
            <div className="pain-card">
              <h3>Wir betreiben kein eigenes Lager</h3>
              <p>
                Wir vermitteln zwischen Shops und Fulfillment-Anbietern. Dadurch haben wir
                kein Interesse daran, dir ein bestimmtes Lager zu verkaufen.
              </p>
            </div>
            <div className="pain-card">
              <h3>Abgleich statt Gießkanne</h3>
              <p>
                Wir gleichen Volumen, Warenart und Zeitrahmen mit Anbietern ab, die dazu
                passen. Passt nichts, melden wir uns auch nicht.
              </p>
            </div>
            <div className="pain-card">
              <h3>Für dich kostenlos</h3>
              <p>
                Der Check und die Vermittlung kosten dich nichts. Bezahlt werden wir von
                den Fulfillment-Anbietern, an die wir vermitteln.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="lp-section lp-final">
        <div className="lp-inner lp-inner--narrow">
          <h2>
            Du kümmerst dich um dein Business.
            <br />
            <span className="accent">Wir finden dein Fulfillment.</span>
          </h2>
          <p className="lead">
            Finde jetzt heraus, ob Outsourcing für deinen Shop sinnvoll ist.
          </p>
          <button className="btn-cta" onClick={scrollToCheck} type="button">
            {hero.cta}
          </button>
          <p className="microcopy">6 Fragen · ca. 60 Sekunden · kostenlos</p>
        </div>
      </section>

      <footer className="lp-footer">
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
      </footer>
    </main>
  );
}
