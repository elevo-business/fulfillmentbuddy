# Fulfillmentbuddy Quiz

Qualifizierungs-Quiz-Funnel für **fulfillmentbuddy.de/quiz1** (Pfad auf der
Hauptdomain, keine eigene Subdomain — via Next.js `basePath: '/quiz1'` in
`next.config.mjs`). Separate Next.js-App im Unterordner `quiz-app/` des
`fulfillmentbuddy`-Repos (Monorepo — der Onepager im Repo-Root bleibt davon
unberührt und komplett statisch).

6 Schritte (Segment, Bestellvolumen, aktuelle Situation, größte
Herausforderung, Dringlichkeit, Kontaktdaten) → Lead wird serverseitig
bewertet und automatisch als Item im monday-CRM-Board **"Fulfillmentbuddy
Leads"** angelegt.

## Stack
Next.js 15 (App Router) + TypeScript, kein UI-Framework — eigenes CSS in
`src/app/globals.css`, gleiche Fonts/Farben wie der Onepager (Fredoka/Nunito,
Anthrazit + Orange).

## Environment-Variablen
Siehe `.env.example`:
- `MONDAY_API_KEY` — **muss in Coolify bei dieser App-Resource gesetzt sein**
  (Server-seitig, nie im Client-Bundle). Personal-/API-Token aus monday.com
  (Profil → Admin → API).
- `MONDAY_BOARD_ID` — Ziel-Board, Default ist bereits richtig gesetzt.

## Monday-Board-Setup (einmalig, manuell)
Der verbundene monday-Account kann per API keine Spalten anlegen (fehlende
Berechtigung). Das Board `Fulfillmentbuddy Leads` existiert bereits, hat aber
nur die Standard-Spalte "Name". Damit die strukturierten Daten ankommen,
bitte **im monday-UI** folgende Spalten mit exakt diesen Titeln anlegen:

| Spaltentitel | Typ | Labels |
|---|---|---|
| Status | Status | Neuer Lead, Kontaktiert, Qualifiziert, Nicht qualifiziert, Kunde geworden |
| E-Mail | E-Mail | — |
| Telefon | Telefon | — |
| Unternehmen | Text | — |
| Segment | Status | E-Commerce & Online-Handel, Marke mit Lagerbedarf, Multichannel-Anbieter, Sonstiges |
| Bestellvolumen/Monat | Status | Unter 100, 100–500, 500–2.000, Über 2.000 |
| Aktuelle Situation | Status | Inhouse / selbst, Dienstleister vorhanden aber unzufrieden, Noch kein Fulfillment-Partner, Wachstum übersteigt aktuelle Kapazität |
| Größte Herausforderung | Status | Steigende Fehlerquote & Retouren, Lagerkapazität am Limit, Saisonale Spitzen (z. B. Black Friday), Lieferzeiten & Kundenerwartung, Intransparente Kosten |
| Dringlichkeit | Status | Akut — wir suchen jetzt, In den nächsten 1–3 Monaten, Explorativ wir informieren uns |
| Lead-Score | Zahl | — |

**Wichtig:** Die App funktioniert auch **ohne** diese Spalten — sie postet in
jedem Fall alle Antworten als vollständigen Kommentar am neuen Lead-Item, es
geht nichts verloren. Die Spalten sind "nice to have" für Filterung/Sortierung
im CRM und werden automatisch befüllt, sobald sie mit exakt passendem Titel
existieren (kein Code-Change nötig — die App fragt die Board-Struktur zur
Laufzeit ab und überspringt fehlende Spalten stillschweigend).

## Lokal entwickeln
```bash
npm install
cp .env.example .env.local   # MONDAY_API_KEY eintragen
npm run dev
```

## Deployment (Coolify)
Eigene Resource, **nicht** dieselbe wie der Onepager — beide teilen sich aber
dieselbe Domain über Pfad-Routing:
1. Neue Resource → Nixpacks (Node/Next.js wird automatisch erkannt) →
   Repo `elevo-business/fulfillmentbuddy`, **Base Directory: `/quiz-app`**.
2. Environment-Variablen `MONDAY_API_KEY` und optional `MONDAY_BOARD_ID` setzen.
3. Domain als `https://fulfillmentbuddy.de/quiz1` eintragen (Pfad, keine
   Subdomain — Coolify/Traefik routet dann `/quiz1/*` zu dieser Resource,
   alles andere weiterhin zur statischen Onepager-Resource). Falls Coolifys
   Domain-Feld keinen Pfad-Suffix akzeptiert: als Fallback `quiz.fulfillmentbuddy.de`
   als eigene Subdomain deployen und `basePath` in `next.config.mjs` entfernen.
4. Kein zusätzlicher DNS-Eintrag nötig, solange Pfad-Routing verwendet wird —
   `fulfillmentbuddy.de` zeigt bereits auf den Server.

## Warum keine Prozess-/Vermittler-Sprache im Funnel
Bewusst so gehalten: Der Funnel fragt und qualifiziert, sagt aber nirgends
explizit "wir vermitteln euch an einen Dienstleister" — das Abschluss-Screen
bleibt allgemein ("wir melden uns mit einer Einschätzung"). Gleiche Logik wie
beim Onepager.
