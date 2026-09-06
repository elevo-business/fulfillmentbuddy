# Fulfillmentbuddy — Onepager

Statischer Onepager für fulfillmentbuddy.de. Reine Sichtbarkeits-/Vertrauensseite:
zeigt Positionierung und fachliche Kompetenz im Fulfillment-Bereich, ohne
Formulare, ohne Ablauf-/Prozessbeschreibung und ohne Verweis auf die separat
laufenden Lead-Funnels/Landingpages.

## Stack
- Reines HTML/CSS, kein Framework, kein Build-Step
- Fonts self-hosted (Fredoka, Nunito) unter `assets/fonts/` — kein Google-CDN
  zur Laufzeit (DSGVO-konform)

## Struktur
```
index.html            Der Onepager
assets/css/style.css   Styles (Brand: Anthrazit/Schwarz + Orange, angelehnt ans Logo)
assets/fonts/          Self-hosted Fredoka & Nunito (woff2)
assets/img/illustrations/  Quell-SVGs der Illustrationen (Referenz, im HTML inline eingebettet)
```

## Illustrationen
Flat-Vector-Illustrationen von [unDraw](https://undraw.co) (Paket `undraw-svg`,
MIT-lizenziert — kostenlose Nutzung, keine Attribution nötig). Farben auf die
Fulfillmentbuddy-Palette umgefärbt (Anthrazit/Cardboard-Beige statt Standard-Lila);
der jeweilige Akzent-Bereich nutzt `currentColor` und erscheint dadurch automatisch
in Marken-Orange. Eingebunden direkt inline im HTML (nicht per `<img>`), damit
`currentColor` funktioniert. Quelldateien liegen zur Referenz zusätzlich unter
`assets/img/illustrations/`.
- Hero: `logistics.svg`
- Anzeichen: `heavy-box.svg`
- Worauf es ankommt: `checking-boxes.svg`
- Über uns: `package-arrived.svg`

## Lokal ansehen
Einfach `index.html` im Browser öffnen, oder z.B.:
```
python3 -m http.server 8000
```

## Offene Punkte vor Live-Schaltung
- **Impressum/Datenschutz**: Für eine öffentlich erreichbare `.de`-Domain mit
  Geschäftsbezug gesetzlich vorgeschrieben (§5 TMG / DSGVO) — hier noch nicht
  enthalten, da bewusst nicht Teil dieses Auftrags.
- **Kontaktmöglichkeit**: aktuell keine (Entscheidung vertagt).
- Logo aktuell nur als Wortmarke + einfaches "F"-Icon umgesetzt (kein Maskottchen-Artwork
  eingebunden) — bei Bedarf finales Logo-Artwork als SVG/PNG in `assets/img/` einbinden.
