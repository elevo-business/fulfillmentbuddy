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
impressum.html         Impressum (§5 TMG)
datenschutz.html        Datenschutzerklärung
assets/css/style.css   Styles (Brand: Anthrazit/Schwarz + Orange, angelehnt ans Logo)
assets/fonts/          Self-hosted Fredoka & Nunito (woff2)
assets/img/logo/           Echtes Maskottchen-Logo (Quelle + optimierte WebP-Derivate)
assets/img/illustrations/  Quell-SVGs der unDraw-Illustrationen (Referenz, im HTML inline eingebettet)
quiz-app/              Next.js Quiz-Funnel (separates Deployment unter /quiz1), work in progress
```

## Logo
`assets/img/logo/mascot-source.png` ist die Original-Datei (Maskottchen +
Wortmarke, KI-generiert). Daraus zwei optimierte WebP-Derivate erzeugt:
- `mascot-badge.webp` — enger Gesichts-Crop, 240×240, für Header- und
  Footer-Icon (13 KB statt 1,2 MB Original)
- `mascot-hero.webp` — Maskottchen mit Paket, ohne die eingebrannte
  Wortmarke (die kommt im HTML als echter Text in Fredoka, nicht als
  Bild-Text), 1000×621, für die Hero-Section (45 KB)

Beide behalten den transparenten Hintergrund des Originals (inkl. weichem
Glow-Rand), dadurch fügen sie sich auf Weiß (Header/Hero) wie auf Dunkel
(Footer) sauber ein.

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

## Deployment (Coolify)
Kein Dockerfile nötig — reines HTML/CSS ohne Build-Step. In Coolify als
**Static Site / Nixpacks** deployen (Coolify erkennt "kein package.json,
kein Build" automatisch und serviert die Dateien direkt, inkl. Gzip/Caching
über den vorgeschalteten Traefik-Proxy).

1. GoDaddy-DNS für `fulfillmentbuddy.de`: A-Record `@` und `www` auf die
   Server-IP (dieselbe wie `elevo.solutions`), DNS-only (kein Proxy).
2. In Coolify: neue Resource → Build Pack **Static** wählen, Repo/Branch
   verbinden, Publish-Directory auf `.` (Repo-Root, da `index.html` dort liegt)
   setzen, Domains `fulfillmentbuddy.de` + `www.fulfillmentbuddy.de` eintragen,
   SSL-Zertifikat generieren lassen.
3. Deploy.

Falls später mal eigene Cache-Header (z. B. 1 Jahr immutable für Fonts/CSS)
oder Security-Header gebraucht werden, kann jederzeit ein schlanker
`nginx:alpine`-Dockerfile ergänzt werden — für den aktuellen Umfang lohnt
sich der Wartungsaufwand aber nicht.

## Rechtliches (Impressum / Datenschutz)
- **Impressum**: von elevo.solutions übernommen (gleiche Rechtsperson —
  ELEVO Solutions, Einzelunternehmen, Inhaber M. Celik, Ahrstraße 6, 52511
  Geilenkirchen, USt-ID DE364166667). Kontakt-E-Mail vorerst `hallo@elevo.solutions`
  (Annahme — bitte korrigieren, falls eine eigene Fulfillmentbuddy-Adresse
  gewünscht ist).
- **Datenschutzerklärung**: **bewusst NICHT** 1:1 von elevo.solutions kopiert —
  Elevos Version enthält Elevo-spezifische Abschnitte (Cloudflare, Kontaktformular→CRM,
  LinkedIn/E-Mail-Kaltakquise, Google Ads, Meta-Pixel mit echten Tracking-IDs),
  die auf diesen Onepager nicht zutreffen (kein Formular, kein Tracking, kein
  Cloudflare). Stattdessen eine schlanke, wahrheitsgemäße Version für genau das,
  was diese Seite tatsächlich tut. **Muss aktualisiert werden, sobald `/quiz1`
  live geht** (dort werden echte personenbezogene Daten verarbeitet).

## Offene Punkte vor Live-Schaltung
- **Kontaktmöglichkeit**: aktuell keine (Entscheidung vertagt).
