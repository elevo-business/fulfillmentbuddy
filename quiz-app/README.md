# Fulfillmentbuddy — App

Eine Next.js-App für die komplette Domain `fulfillmentbuddy.de` — **eine
Coolify-Resource, ein Deployment**, kein Pfad-Routing zwischen mehreren
Resources nötig (das hatten wir zuerst versucht, ist aber an Coolify/Traefik
gescheitert: eine reine Static-Site-Resource kann keinen Node-Server für
`/quiz1` mitbedienen).

## Routen
| Pfad | Was | Wie ausgeliefert |
|---|---|---|
| `/` | Onepager (Hero, Zielgruppen, Anzeichen, Kriterien, Über uns) | Statisches HTML aus `public/index.html`, per Next-Rewrite |
| `/impressum` | Impressum | Statisches HTML aus `public/impressum.html` |
| `/datenschutz` | Datenschutzerklärung | Statisches HTML aus `public/datenschutz.html` |
| `/quiz1` | Qualifizierungs-Quiz (6 Schritte) | Echte React-Route (`src/app/quiz1/page.tsx`) |
| `/api/submit` | Server-Route, nimmt Quiz-Antworten entgegen | `src/app/api/submit/route.ts`, ruft monday-API |
| `/api/verify/send` | Startet SMS-OTP-Verifizierung fürs Telefonfeld | `src/app/api/verify/send/route.ts`, ruft Twilio Verify |
| `/api/verify/check` | Prüft eingegebenen SMS-Code | `src/app/api/verify/check/route.ts`, ruft Twilio Verify |

Die drei HTML-Seiten sind bewusst **kein** React/JSX — sie sind 1:1 der
ursprüngliche statische Onepager, nur aus `public/` ausgeliefert via
`rewrites()` in `next.config.mjs`. Kein Risiko, kein Konvertierungsaufwand,
funktioniert identisch wie vorher.

## Stack
Next.js 15 (App Router) + TypeScript für `/quiz1` + `/api/submit`. Für den
Onepager kein Framework — eigenes CSS (`public/assets/css/style.css`),
gleiche Fonts/Farben wie überall (Fredoka/Nunito, Anthrazit + Orange,
self-hosted, kein Google-CDN).

## Struktur
```
next.config.mjs        Rewrites (/, /impressum, /datenschutz → HTML in public/)
public/
  index.html            Onepager
  impressum.html         Impressum (§5 TMG)
  datenschutz.html        Datenschutzerklärung
  assets/css/style.css   Onepager-Styles
  assets/fonts/          Self-hosted Fredoka & Nunito (woff2)
  assets/img/logo/        Maskottchen-Logo (WebP-Derivate)
src/
  app/
    quiz1/page.tsx        Quiz-Einstiegsseite
    api/submit/route.ts   Server-Route → monday CRM
    layout.tsx, globals.css   Layout & Styles für /quiz1
  components/Quiz.tsx      6-Schritte-Quiz-Logik (Client-Component)
  lib/
    scoring.ts             Lead-Scoring (0–100, additiv)
    monday.ts               monday-API-Anbindung (robust, siehe unten)
```

## Logo & Illustrationen
- `public/assets/img/logo/mascot-badge.webp` (Gesichts-Crop, Header/Footer-Icon)
  und `mascot-hero.webp` (Maskottchen mit Paket, Hero-Section) — Derivate des
  vom Nutzer bereitgestellten KI-generierten Original-Logos, transparenter
  Hintergrund inkl. weichem Glow, dadurch auf Weiß wie auf Dunkel einsetzbar.
- Die vier Content-Illustrationen (Anzeichen/Kriterien/Über-uns/Hero-Kontext)
  im Onepager-HTML sind inline-SVG von [unDraw](https://undraw.co) (MIT,
  kostenlos, keine Attribution nötig), auf die Marken-Palette umgefärbt.

## Environment-Variablen
Siehe `.env.example`:
- `MONDAY_API_KEY` — **muss in Coolify gesetzt sein** (Server-seitig, nie im
  Client-Bundle). Personal-/API-Token aus monday.com (Profil → Admin → API).
- `MONDAY_BOARD_ID` — Ziel-Board, Default ist bereits richtig gesetzt
  (`5103645238`, Board "Fulfillmentbuddy Leads").
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` —
  **müssen in Coolify gesetzt sein**. Telefon-Verifizierung ist **Pflicht
  fürs Absenden** (validateContact() in `Quiz.tsx`, Submit-Button ist bis
  dahin deaktiviert) — fehlen die Keys oder schlägt Twilio fehl, kann
  **niemand mehr das Quiz abschicken**. Account SID + Auth Token:
  twilio.com/console. Verify Service SID: Twilio Console → Verify →
  Services → Service anlegen/auswählen (Format „VAxxx…").
  **Trial-Falle:** Ein neuer Twilio-Account darf im Trial-Modus nur an
  manuell unter „Verified Caller IDs" hinterlegte Nummern senden — echte
  Ad-Leads mit fremden Nummern schlagen sonst mit
  `To send messages ... you must have an approved Primary Compliance
  Profile` fehl. Für den Live-Betrieb: Twilio Console → Account →
  **Compliance Profile** einreichen und genehmigen lassen (bzw. Account
  voll upgraden), sonst bleibt der Funnel für echten Traffic blockiert.
  Kosten: ca. 0,05–0,06 €/SMS in Deutschland.

## Monday-Board-Setup (einmalig, manuell)
Der verbundene monday-Account kann per API keine Spalten anlegen (fehlende
Berechtigung, 403). Board: `Leads` (Workspace „CRM", `elevo-bunch.monday.com`,
Board-ID `5103645238`). Spalten bitte **im monday-UI** mit exakt diesen
Titeln anlegen — der Typ ist bewusst frei wählbar, der Code erkennt den
tatsächlichen Spaltentyp zur Laufzeit (`valueForColumn()` in `monday.ts`) und
formatiert den Wert passend (Status-Spalten bekommen `{ label }`, alles
andere einen einfachen Text):

| Spaltentitel | Empfohlener Typ | Werte |
|---|---|---|
| Status | Status | Neuer Lead, Kontaktiert, Qualifiziert, Nicht qualifiziert, Kunde geworden — **kritisch:** löst die CAPI-Automation aus, die beim Label „Qualifiziert" ein Event an Meta sendet. Nicht löschen. |
| E-Mail | E-Mail | — |
| Telefon | Telefon | — |
| Unternehmen | Text | — |
| Segment | Text oder Status | E-Commerce & Online-Handel, Marke mit Lagerbedarf, Multichannel-Anbieter, Sonstiges |
| Bestellvolumen/Monat | Text oder Status | Unter 500, 500–1.000, 1.000–2.000, 2.000+ |
| Lagerbedarf (Paletten/Monat) | Text oder Status | 0–10, 10–20, 30–50, 50+, Nicht sicher |
| Aktuelle Situation | Text oder Status | Inhouse / selbst, Dienstleister vorhanden aber unzufrieden, Noch kein Fulfillment-Partner, Wachstum übersteigt aktuelle Kapazität |
| Größte Herausforderung | Text oder Status | Steigende Fehlerquote & Retouren, Lagerkapazität am Limit, Saisonale Spitzen (z. B. Black Friday), Lieferzeiten & Kundenerwartung, Intransparente Kosten |
| Dringlichkeit | Text oder Status | Akut — wir suchen jetzt, In den nächsten 1–3 Monaten, Explorativ wir informieren uns |
| Lead-Score | Text oder Zahl | — |
| Shop-Link | Text oder Link | — (optionales Feld im Quiz) |
| Telefon verifiziert | Haken | — (true/false, per SMS-OTP über Twilio Verify) |
| Quelle | Status | funnel, meta-form |
| Kampagne | Text | — |
| Meta Event-ID | Text | — |
| Ersetzt | Haken | — |

**Wichtig:** Die App funktioniert auch **ohne** diese Spalten — sie postet in
jedem Fall alle Antworten als vollständigen Kommentar am neuen Lead-Item, es
geht nichts verloren. Fehlende Spalten werden beim Schreiben stillschweigend
übersprungen (kein Code-Change nötig — die App fragt die Board-Struktur zur
Laufzeit ab).

## Lokal entwickeln
```bash
npm install
cp .env.example .env.local   # MONDAY_API_KEY eintragen
npm run dev
```
Dann `http://localhost:3000/`, `/impressum`, `/datenschutz`, `/quiz1` testen.

## Deployment (Coolify)
**Eine** Resource für die ganze Domain:
1. Resource → Build Pack **Nixpacks** (erkennt Next.js automatisch anhand
   von `package.json`) → Repo `elevo-business/fulfillmentbuddy`,
   **Base Directory: `/quiz-app`**.
2. Environment-Variablen `MONDAY_API_KEY` (Pflicht) und optional
   `MONDAY_BOARD_ID` setzen.
3. Domain `fulfillmentbuddy.de` (+ `www.fulfillmentbuddy.de`) eintragen,
   SSL generieren lassen.
4. Deploy. Kein weiterer DNS-Eintrag nötig — `fulfillmentbuddy.de` zeigt
   bereits auf den Server.

Falls bereits eine **separate** Static-Site-Resource für den alten,
reinen HTML-Onepager existiert: die kann jetzt **gelöscht** werden (oder auf
"Stopped" gesetzt), sonst konkurrieren zwei Resources um dieselbe Domain.

## Warum keine Prozess-/Vermittler-Sprache im Funnel
Bewusst so gehalten: Der Funnel fragt und qualifiziert, sagt aber nirgends
explizit "wir vermitteln euch an einen Dienstleister" — das Abschluss-Screen
bleibt allgemein ("wir melden uns mit einer Einschätzung"). Gleiche Logik wie
beim Onepager.
