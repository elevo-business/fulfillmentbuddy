# Fulfillmentbuddy

Eine einzige Next.js-App (`quiz-app/`) bedient die komplette Domain
`fulfillmentbuddy.de`:

- `/`, `/impressum`, `/datenschutz` — statischer Onepager (reines HTML,
  per Next.js-Rewrite aus `public/` ausgeliefert, kein React nötig)
- `/quiz1` — echte React/Next-App: Qualifizierungs-Quiz-Funnel, der
  Ergebnisse serverseitig an monday CRM übergibt

Der Onepager selbst ist eine reine Sichtbarkeits-/Vertrauensseite: zeigt
Positionierung und fachliche Kompetenz im Fulfillment-Bereich, ohne
Formulare oder Ablauf-/Prozessbeschreibung. Die eigentliche Lead-Erfassung
läuft ausschließlich über `/quiz1`.

**Alles Weitere (Struktur, Setup, Deployment, Logo/Illustrationen,
monday-Anbindung) steht in [`quiz-app/README.md`](quiz-app/README.md) —
das ist jetzt die einzige Deploy-Einheit.**

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
  was diese Seite tatsächlich tut. Sobald `/quiz1` live Daten sammelt, gilt dort
  zusätzlich eine eigene Datenschutzerklärung (noch zu ergänzen).

## Offene Punkte vor Live-Schaltung
- **Kontaktmöglichkeit auf dem Onepager**: aktuell keine (Entscheidung vertagt).
- **monday-Board-Spalten**: müssen einmalig manuell im monday-UI angelegt werden
  (siehe `quiz-app/README.md`) — die App funktioniert auch ohne, verliert aber
  keine Daten (alles landet zusätzlich immer als Kommentar am Lead).
