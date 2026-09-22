'use client';

import { useEffect, useState } from 'react';
import Quiz from './Quiz';
import { track } from '@/lib/tracking';

/**
 * Aufbau: Headline, dann sofort das Quiz. Kein Hero mit CTA, der erst nach
 * unten scrollt.
 *
 * Grund steht in den Pixel-Daten: Von den Landingpage-Aufrufen haben nur
 * rund ein Drittel den CTA ueberhaupt geklickt — das war der groesste
 * Einzelverlust im ganzen Funnel. Wer dagegen anfaengt, macht zu 77 %
 * fertig und beantwortet im Schnitt 5,45 von 6 Fragen. Das Quiz ist der
 * staerkste Teil der Seite und steht deshalb an erster Stelle. Alles
 * andere (Pain, Einwaende, Modell) rutscht darunter, fuer die, die
 * scrollen wollen.
 */

/**
 * Zwei Headline-Varianten, gesteuert ueber ?v=b in der Ziel-URL der
 * Anzeige. Beide benennen das Problem und nicht die Leistung, nennen den
 * Aufwand (6 Fragen, 60 Sekunden) und nehmen die Hemmschwelle vorweg
 * (Ergebnis ohne E-Mail, kein Termin). Default ist A.
 */
const HERO_VARIANTS = {
  a: {
    headline: 'Was kostet dich dein Versand wirklich?',
    sub: 'Die meisten Shops rechnen nur das Porto. 6 Fragen, 60 Sekunden — danach kennst du deine echten Kosten pro Paket und weißt, ob sich Auslagern für dich schon rechnet.',
  },
  b: {
    headline: 'Ab wann lohnt sich Fulfillment für deinen Shop?',
    sub: '6 Fragen, 60 Sekunden. Danach hast du eine klare Einschätzung — und deine echten Kosten pro Paket. Ohne Termin, ohne Verkaufsgespräch.',
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

  /** Nur noch der CTA am Seitenende — oben steht das Quiz bereits. */
  function scrollToCheck() {
    track('CheckCtaClicked', { variant });
    document.getElementById('check')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="lp">
      {/* ---------- HEADLINE + QUIZ ---------- */}
      <section className="lp-hero lp-hero--quiz" id="check">
        <div className="lp-inner lp-inner--narrow">
          <p className="eyebrow">Fulfillmentbuddy</p>
          <h1>{hero.headline}</h1>
          <p className="lead">{hero.sub}</p>

          <Quiz />

          <p className="microcopy microcopy--hero">
            Ergebnis sofort — ohne E-Mail-Adresse. Kein Termin, kein Verkaufsgespräch.
          </p>
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

      {/* ---------- QUALIFIZIERUNG ---------- */}
      <section className="lp-section">
        <div className="lp-inner lp-inner--narrow">
          <h2>Für wen der Check gedacht ist</h2>
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
            6 Fragen, 60 Sekunden — und du weißt, woran du bist.
          </p>
          <button className="btn-cta" onClick={scrollToCheck} type="button">
            Zum Check →
          </button>
        </div>
      </section>

      <footer className="lp-footer">
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
      </footer>
    </main>
  );
}
