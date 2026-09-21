import { NextResponse } from 'next/server';

/**
 * Diagnose der CRM-Anbindung.
 *
 * Existiert, weil sich von aussen nicht unterscheiden liess, ob der
 * HubSpot-Aufruf an einem fehlenden Token, falschen Scopes oder einer
 * Umgebungsvariable scheitert, die den Container gar nicht erreicht —
 * `/api/submit` meldet in allen drei Faellen nur "monday".
 *
 * Gibt bewusst KEINE Geheimnisse preis: vom Token nur, ob er da ist, sein
 * Praefix (das die Region verraet) und seine Laenge — genug, um einen beim
 * Kopieren abgeschnittenen Token zu erkennen, zu wenig, um ihn zu benutzen.
 *
 * Nach erfolgreicher Umstellung wieder entfernen.
 */
export const dynamic = 'force-dynamic';

type Probe = { ok: boolean; status: number | null; category?: string; message?: string };

async function probe(path: string, token: string, baseUrl: string): Promise<Probe> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const text = await res.text();
    let category: string | undefined;
    let message: string | undefined;
    try {
      const json = JSON.parse(text) as { category?: string; message?: string };
      category = json.category;
      message = json.message?.slice(0, 200);
    } catch {
      message = text.slice(0, 200);
    }
    return { ok: res.ok, status: res.status, category, message };
  } catch (err) {
    // Netzwerk-/DNS-Fehler: der Container kommt gar nicht raus.
    return { ok: false, status: null, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const baseUrl = process.env.HUBSPOT_API_BASE_URL || 'https://api.hubapi.com';

  const hubspot: Record<string, unknown> = {
    tokenPresent: Boolean(token),
    tokenPrefix: token ? token.split('-').slice(0, 2).join('-') : null,
    tokenLength: token ? token.length : 0,
    baseUrl,
  };

  if (token) {
    // Zwei getrennte Proben, damit sichtbar wird, WELCHER Scope fehlt.
    hubspot.schemaRead = await probe('/crm/v3/properties/contacts', token, baseUrl);
    hubspot.contactsRead = await probe('/crm/v3/objects/contacts?limit=1', token, baseUrl);
  }

  return NextResponse.json({
    hubspot,
    monday: { keyPresent: Boolean(process.env.MONDAY_API_KEY) },
    // Fingerabdruck: erscheint dieses Feld nicht, laeuft noch ein alter Build.
    build: 'crm-health-v1',
  });
}
