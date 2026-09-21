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
| `/quiz1` | Landingpage + Fulfillment-Check (Rolle + 6 Fragen) | Echte React-Route (`src/app/quiz1/page.tsx`) |
| `/api/submit` | Server-Route, nimmt Quiz-Antworten entgegen | `src/app/api/submit/route.ts`, ruft HubSpot-API, gibt `itemId` + `crm` zurück |
| `/api/enrich` | Trägt Rechnerwerte am bestehenden Lead nach | `src/app/api/enrich/route.ts` — **kein** zweites `create_item` |
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
    api/submit/route.ts   Server-Route → HubSpot CRM (monday als Fallback)
    layout.tsx, globals.css   Layout & Styles für /quiz1
  components/LandingPage.tsx  Landingpage-Sections + A/B-Hero, umschliesst das Quiz
  components/Quiz.tsx         Check-Logik: Gate, 6 Fragen, Lead, Ergebnis
  lib/
    costCalc.ts            Paketkosten-Rechner (reine Arithmetik, keine Benchmarks)
    tracking.ts            Funnel-Events fuer den Meta-Pixel
    assessment.ts          Ergebnistexte für den Prospect
    scoring.ts             Lead-Scoring (0–100, additiv) + harte Ausschlussgründe
    hubspot.ts              HubSpot-Contacts-Anbindung (robust, siehe unten)
    attribution.ts          UTM-Herkunft sichern (sessionStorage)
    monday.ts               monday-API-Anbindung (Uebergangs-Fallback)
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
- `HUBSPOT_PRIVATE_APP_TOKEN` — **muss in Coolify gesetzt sein.** Primaere
  Lead-Senke. HubSpot → Einstellungen → Integrationen → Private Apps.
  Scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`,
  `crm.schemas.contacts.read`.
- `HUBSPOT_API_BASE_URL` — normalerweise leer lassen. Nur setzen, wenn der
  Standard-Endpunkt das Portal nicht erreicht (EU-Portale, Token
  `pat-eu1-…`): dann `https://api-eu1.hubapi.com`.
- `MONDAY_API_KEY` — **optional, Uebergangs-Fallback.** Wird nur noch
  angesprochen, wenn der HubSpot-Aufruf fehlschlaegt. Ist der Wechsel durch,
  Variable entfernen — dann faellt der Fallback-Zweig von selbst weg.
- `MONDAY_BOARD_ID` — Ziel-Board des Fallbacks (`5103645238`).
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` —
  nötig, solange der optionale SMS-Bestätigungs-Button im Formular steht.
  Telefon-Verifizierung ist **aktuell optional**: die Telefonnummer selbst
  ist Pflichtfeld, die SMS-Bestätigung nicht. Wer bestätigt, landet mit
  `Telefon verifiziert = true` im CRM. Fehlen die Keys, schlägt nur der
  Bestätigungs-Button fehl, das Quiz bleibt absendbar. Account SID + Auth Token:
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

## CRM: HubSpot (Contacts API)

Das Quiz postet den fertigen Lead server-seitig gegen die HubSpot Contacts
API. Bewusst **kein HubSpot-Formular und kein Tracking-Code**: das Quiz
bleibt unveraendert und es kommt keine weitere Cookie-/Consent-Baustelle
dazu.

Upsert laeuft ueber die E-Mail (`idProperty: email`) — wer das Quiz ein
zweites Mal ausfuellt, aktualisiert denselben Kontakt statt eine Dublette zu
erzeugen.

**Ohne jede Einrichtung nutzbar.** HubSpot legt unbekannte Properties nicht
automatisch an und quittiert sie mit 400 — ein einziges fehlendes Feld wuerde
den ganzen Lead kosten. Deshalb fragt `src/lib/hubspot.ts` das
Property-Schema des Portals ab (5 Min. gecacht) und sendet nur, was
existiert; bei Auswahllisten zusaetzlich nur gueltige Optionen. Die
vollstaendigen Antworten landen immer zusaetzlich als lesbarer Text in der
Standard-Property `message`, es geht also nie etwas verloren.

Optional koennen diese Custom Properties (Typ: Einzeiliger Text, `fb_score`
als Zahl) im HubSpot-UI angelegt werden — sie fuellen sich ab dann von
selbst, ohne Code-Aenderung:

`fb_score`, `fb_status`, `fb_blockers`, `fb_intent`, `fb_role`, `fb_volume`,
`fb_process`, `fb_time_spent`, `fb_challenge`, `fb_growth`, `fb_priority`,
`fb_suspected_bot`, `fb_utm_source`, `fb_utm_medium`, `fb_utm_campaign`,
`fb_utm_content`, `fb_utm_term`, `fb_landing_url`, `fb_referrer`

Fuer den Paketkosten-Rechner zusaetzlich (Typ: Zahl): `fb_parcels_per_month`,
`fb_cost_per_parcel`, `fb_labor_share_pct`, `fb_fte_equivalent`.

### Herkunft / Attribution
`src/lib/attribution.ts` sichert die UTM-Parameter beim ersten Seitenaufruf
in `sessionStorage` und schickt sie beim Absenden mit. Ohne das endet die
Meta-Auswertung beim Klick und das CRM beginnt beim Formular — ein
Creative-Test laesst sich dann nicht bis zum qualifizierten Lead durchziehen.
Ein spaeterer Aufruf ohne UTMs ueberschreibt einen bereits gesicherten Wert
nicht.

### Wenn beide Senken ausfallen
`/api/submit` meldet nur `ok`, wenn eine echte Datensatz-ID zurueckkam — ein
Lead-Event ohne Eintrag dahinter liesse Meta auf Phantom-Conversions
optimieren. Faellt HubSpot **und** der monday-Fallback aus, wird der
vollstaendige Payload ins Log geschrieben
(`LEAD NICHT GESPEICHERT`) und ist aus den Coolify-Logs rekonstruierbar.

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
| Status | Status | Neuer Lead, Kontaktiert, Qualifiziert, **Nicht lieferbar**, Nicht qualifiziert, Kunde geworden — **kritisch:** löst die CAPI-Automation aus, die beim Label „Qualifiziert" ein Event an Meta sendet. Nicht löschen. „Nicht lieferbar" setzt die App selbst, wenn `leadBlockers()` anspringt. |
| E-Mail | E-Mail | — |
| Telefon | Telefon | — |
| Unternehmen | Text | — |
| Rolle | Text oder Status | Inhaber / Geschäftsführung, Betrieb / Logistik, Andere |
| Bestellvolumen/Monat | Text oder Status | 0–100, 100–500, 500–1.000, 1.000–5.000, 5.000+ |
| Pakete/Monat (Angabe) | Text oder Zahl | — (exakte Zahl aus dem Rechner) |
| Ist-Kosten pro Paket | Text oder Zahl | — (vom Interessenten selbst gerechnet, in EUR) |
| Personalanteil % | Text oder Zahl | — (Anteil Personal an seinen Abwicklungskosten) |
| Aktuelle Situation | Text oder Status | Ich mache es selbst, Eigenes Team, Teilweise ausgelagert, Vollständig ausgelagert |
| Zeitaufwand/Woche | Text oder Status | Unter 5 Stunden/Woche, 5–15 Stunden, 15–30 Stunden, 30+ Stunden |
| Größte Herausforderung | Text oder Status | Zu wenig Lagerplatz, Zu viel Personalaufwand, Zu viel Zeitaufwand, Versandkosten, Retouren, Wachstum / Skalierung |
| Wachstumsziel | Text oder Status | Unter 10 %, 10–30 %, 30–100 %, Mehr als 100 % |
| Wichtigstes Kriterium | Text oder Status | Zeit sparen, Kosten reduzieren, Skalieren, Weniger operative Arbeit, Professionellere Prozesse |
| Intent | Text oder Status | high, medium, low |
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

## Funnel-Aufbau (`/quiz1`)

Die Route ist eine vollstaendige Direct-Response-Landingpage, kein nacktes
Quiz mehr: Hero, Selbstqualifizierung, Pain-Section, Check-Erklaerung, der
Check selbst, Einwandbehandlung, Transparenz-Section, Final-CTA.

**Reihenfolge im Check** (`Phase` in `Quiz.tsx`):

1. **Gate** — Rolle im Unternehmen. Zaehlt bewusst nicht als "Frage",
   damit die im Ad versprochenen 6 Fragen stimmen. Wer "Andere" waehlt,
   landet auf einer Hinweisseite statt im Check.
2. bis 7. **Sechs Fragen** — Volumen, aktueller Prozess, Zeitaufwand,
   Herausforderung, Wachstum, wichtigstes Kriterium.
8. **Kontakt** — Vorname, Firma, E-Mail, Telefon (Pflicht), Shoplink
   (optional), SMS-Bestaetigung (optional).
9. **Ergebnis** — dynamische Einschaetzung mit Ampel aus `assessment.ts`.
10. **Optional: Paketkosten-Rechner** — nach dem Ergebnis, nicht davor.
    Reichert den bestehenden Lead ueber `/api/enrich` an.

Drei Dinge, die bewusst so sind:

- **Fulfillmentbuddy betreibt kein Lager.** Die Seite sagt das explizit in
  der Transparenz-Section. Wir vermitteln an Anbieter und werden von denen
  bezahlt. Copy, die uns als Lagerbetreiber darstellt, waere irrefuehrend
  (UWG §5) und erzeugt Leads, die einen Anruf von einer Firma bekommen,
  die sie nicht erwarten.
- **Keine Testimonials, Logos oder Zahlen**, solange es keine echten gibt.
  Die Transparenz-Section erklaert stattdessen das Modell.
- **Keine Branchen-Benchmarks**, weder in `costCalc.ts` noch in
  `assessment.ts`. Die einzigen Konstanten im Rechner sind Umrechnungen
  (52/12 Wochen pro Monat, 40-Stunden-Woche fuer die Vollzeitaequivalenz).

### A/B-Test der Hero-Variante

`?v=b` in der Ziel-URL der Anzeige schaltet auf die Growth-Variante
("Dein Shop soll wachsen. Nicht dein Lager."), Default ist die
Pain-Variante ("Packst du noch deine Pakete selbst?"). Beide nutzen
denselben Check, damit nur der Hook variiert.

### Tracking

`src/lib/tracking.ts` feuert ueber den Pixel: `QuizStart`,
`QuizQuestionAnswered` (mit Frage und Position), `QuizComplete`,
`CheckCtaClicked`, `CalculatorCompleted` als Custom Events sowie `Lead`
als Meta-Standardevent nach erfolgreichem Absenden. Damit ist erstmals
sichtbar, an welchem Schritt Leute abspringen.

### Design

`/quiz1` laeuft auf Schwarz / Weiss / Neon-Gelb (`globals.css`), damit es
visuell an die Meta-Creatives anschliesst. Der Onepager unter `/` nutzt
weiterhin `public/assets/css/style.css` mit dem hellen Orange-Layout —
die beiden Routen sehen also unterschiedlich aus. Das ist Absicht,
solange die Startseite nicht nachgezogen wird.

Ein Hero-Bild liegt bewusst nicht im Repo. `.lp-hero` ist so gebaut, dass
es ohne Foto traegt; ein eigenes Creative kann als `background-image`
ergaenzt werden.

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
