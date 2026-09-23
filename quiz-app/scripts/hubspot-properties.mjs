#!/usr/bin/env node
/**
 * Legt die fb_*-Kontakt-Properties in HubSpot an — oder zeigt erst, welche
 * fehlen.
 *
 * Warum es das gibt: `src/lib/hubspot.ts` sendet ausschliesslich Felder,
 * die im Portal existieren. Das schuetzt den Lead (HubSpot lehnt
 * unbekannte Properties mit 400 ab und der ganze Datensatz waere weg),
 * bedeutet aber auch: Solange die Properties fehlen, landen die
 * Quiz-Antworten nur im Standardfeld `message` statt in eigenen Spalten.
 *
 * Aufruf:
 *   HUBSPOT_PRIVATE_APP_TOKEN=pat-... node scripts/hubspot-properties.mjs --check
 *   HUBSPOT_PRIVATE_APP_TOKEN=pat-... node scripts/hubspot-properties.mjs --create
 *
 * --check  liest nur (Scope crm.schemas.contacts.read)
 * --create legt die fehlenden an (Scope crm.schemas.contacts.write)
 *
 * Bereits vorhandene Properties werden nicht angefasst.
 */

const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const BASE = process.env.HUBSPOT_API_BASE_URL || 'https://api.hubapi.com';
const GROUP = 'fulfillmentbuddy';

if (!TOKEN) {
  console.error('HUBSPOT_PRIVATE_APP_TOKEN ist nicht gesetzt.');
  process.exit(1);
}

const mode = process.argv.includes('--create') ? 'create' : 'check';

/** text = einzeiliger Text, number = Zahl. Reihenfolge = Anzeigereihenfolge. */
const PROPS = [
  ['fb_score', 'Lead-Score', 'number', 'Additiver Score 0–100 aus scoring.ts.'],
  ['fb_status', 'Lead-Status (Check)', 'text', 'Qualifiziert / Neuer Lead / Nicht qualifiziert / Nicht lieferbar.'],
  ['fb_blockers', 'Ausschlussgründe', 'text', 'Harte Ausschlussgründe, kommasepariert. Leer = keine.'],
  ['fb_intent', 'Intent-Stufe', 'text', 'high / medium / low.'],
  ['fb_role', 'Rolle im Unternehmen', 'text', 'Antwort auf die Rollenfrage.'],
  ['fb_volume', 'Bestellungen pro Monat', 'text', 'Gewählte Spanne aus dem Check.'],
  ['fb_process', 'Fulfillment aktuell', 'text', 'Wie heute versendet wird.'],
  ['fb_time_spent', 'Zeitaufwand pro Woche', 'text', 'Gewählte Spanne aus dem Check.'],
  ['fb_challenge', 'Größte Herausforderung', 'text', 'Antwort aus dem Check.'],
  ['fb_growth', 'Wachstumsziel 12 Monate', 'text', 'Antwort aus dem Check.'],
  ['fb_priority', 'Wichtigstes Kriterium', 'text', 'Altfeld — die Frage wurde aus dem Check entfernt.'],
  ['fb_suspected_bot', 'Spam-Verdacht', 'text', 'true, wenn das Honeypot-Feld ausgefüllt war.'],
  ['fb_utm_source', 'UTM Source', 'text', 'Herkunft aus der Anzeigen-URL.'],
  ['fb_utm_medium', 'UTM Medium', 'text', 'Herkunft aus der Anzeigen-URL.'],
  ['fb_utm_campaign', 'UTM Campaign', 'text', 'Herkunft aus der Anzeigen-URL.'],
  ['fb_utm_content', 'UTM Content', 'text', 'Anzeige bzw. Testzelle.'],
  ['fb_utm_term', 'UTM Term', 'text', 'Herkunft aus der Anzeigen-URL.'],
  ['fb_landing_url', 'Einstiegsseite', 'text', 'Vollständige URL des ersten Seitenaufrufs.'],
  ['fb_referrer', 'Referrer', 'text', 'Verweisende Seite beim ersten Aufruf.'],
  ['fb_parcels_per_month', 'Pakete pro Monat (Rechner)', 'number', 'Eingabe aus dem Paketkosten-Rechner.'],
  ['fb_cost_per_parcel', 'Kosten pro Paket (Rechner)', 'number', 'Errechnete Abwicklungskosten je Paket, in Euro.'],
  ['fb_labor_share_pct', 'Personalanteil in % (Rechner)', 'number', 'Anteil Personal an den Abwicklungskosten.'],
  ['fb_fte_equivalent', 'Vollzeitstellen (Rechner)', 'number', 'Wie viele Vollzeitstellen der Versand bindet.'],
];

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* Rohtext behalten */ }
  return { ok: res.ok, status: res.status, json, text };
}

async function main() {
  const schema = await api('/crm/v3/properties/contacts');
  if (!schema.ok) {
    console.error(`Schema nicht lesbar (${schema.status}): ${schema.text.slice(0, 300)}`);
    console.error('Fehlt der Scope crm.schemas.contacts.read?');
    process.exit(1);
  }
  const existing = new Set(schema.json.results.map((p) => p.name));

  const missing = PROPS.filter(([name]) => !existing.has(name));
  const present = PROPS.filter(([name]) => existing.has(name));

  console.log(`Portal kennt ${existing.size} Kontakt-Properties.`);
  console.log(`Standardfeld "message" vorhanden: ${existing.has('message') ? 'ja' : 'NEIN — dann fehlt auch der Volltext!'}`);
  console.log(`fb_*-Properties vorhanden: ${present.length} von ${PROPS.length}`);
  if (present.length) console.log('  ' + present.map(([n]) => n).join(', '));
  console.log(`Fehlen: ${missing.length}`);
  if (missing.length) console.log('  ' + missing.map(([n]) => n).join(', '));

  if (mode === 'check') {
    console.log('\nNur geprüft. Zum Anlegen: --create (braucht crm.schemas.contacts.write).');
    return;
  }
  if (!missing.length) {
    console.log('\nNichts zu tun.');
    return;
  }

  // Eigene Gruppe, damit die Felder im Kontakt nicht zwischen den
  // Standardfeldern untergehen. Existiert sie schon, ist der 409 egal.
  const grp = await api('/crm/v3/properties/contacts/groups', {
    method: 'POST',
    body: JSON.stringify({ name: GROUP, label: 'Fulfillmentbuddy Check' }),
  });
  const groupName = grp.ok || grp.status === 409 ? GROUP : 'contactinformation';
  if (!grp.ok && grp.status !== 409) {
    console.log(`Gruppe konnte nicht angelegt werden (${grp.status}) — nutze "contactinformation".`);
  }

  let created = 0;
  for (const [name, label, type, description] of missing) {
    const body = {
      name,
      label,
      description,
      groupName,
      type: type === 'number' ? 'number' : 'string',
      fieldType: type === 'number' ? 'number' : 'text',
    };
    const r = await api('/crm/v3/properties/contacts', { method: 'POST', body: JSON.stringify(body) });
    if (r.ok) { created++; console.log(`  angelegt: ${name}`); }
    else console.error(`  FEHLER ${name} (${r.status}): ${r.text.slice(0, 200)}`);
  }
  console.log(`\n${created} von ${missing.length} angelegt.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
