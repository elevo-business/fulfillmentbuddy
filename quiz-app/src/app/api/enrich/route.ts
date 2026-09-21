import { NextRequest, NextResponse } from 'next/server';
import { enrichLeadWithCosts } from '@/lib/monday';
import { enrichContactWithCosts, isHubspotConfigured } from '@/lib/hubspot';

/**
 * Traegt die Werte des optionalen Paketkosten-Rechners an einem bereits
 * angelegten Lead nach. Eigene Route statt eines zweiten /api/submit:
 * sonst entstuende ein Duplikat im CRM und der Rate-Limiter dort wuerde
 * den Nachtrag ausserdem als Doppel-Submit blocken.
 */
export async function POST(req: NextRequest) {
  let body: {
    itemId?: string;
    crm?: string;
    parcelsPerMonth?: number;
    costPerParcel?: number;
    laborSharePct?: number;
    fteEquivalent?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  const { itemId, crm, parcelsPerMonth, costPerParcel, laborSharePct, fteEquivalent } = body;
  if (!itemId || !/^\d+$/.test(itemId)) {
    return NextResponse.json({ error: 'Ungültige itemId.' }, { status: 400 });
  }
  if (
    typeof parcelsPerMonth !== 'number' ||
    typeof costPerParcel !== 'number' ||
    typeof laborSharePct !== 'number' ||
    typeof fteEquivalent !== 'number' ||
    ![parcelsPerMonth, costPerParcel, laborSharePct, fteEquivalent].every(Number.isFinite)
  ) {
    return NextResponse.json({ error: 'Ungültige Rechnerwerte.' }, { status: 400 });
  }

  // In dieselbe Datenbank nachtragen, die den Lead aufgenommen hat. HubSpot-
  // Kontakt-IDs und monday-Item-IDs sind beide rein numerisch, an der ID
  // allein laesst sich das also nicht erkennen — deshalb schickt der Client
  // mit, welches CRM es war. Fehlt die Angabe (aelterer, noch ausgelieferter
  // Client), gilt die frueher einzige Senke: monday.
  const costs = { parcelsPerMonth, costPerParcel, laborSharePct, fteEquivalent };
  const target = crm === 'hubspot' || crm === 'monday' ? crm : 'monday';

  try {
    if (target === 'hubspot') {
      if (!isHubspotConfigured()) {
        return NextResponse.json({ error: 'HubSpot nicht konfiguriert.' }, { status: 502 });
      }
      await enrichContactWithCosts(itemId, costs);
    } else {
      await enrichLeadWithCosts(itemId, costs);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${target} enrich failed`, err);
    return NextResponse.json({ error: 'Nachtrag fehlgeschlagen.' }, { status: 502 });
  }
}
