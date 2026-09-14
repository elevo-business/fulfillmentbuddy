import { NextRequest, NextResponse } from 'next/server';
import { enrichLeadWithCosts } from '@/lib/monday';

/**
 * Traegt die Werte des optionalen Paketkosten-Rechners an einem bereits
 * angelegten Lead nach. Eigene Route statt eines zweiten /api/submit:
 * sonst entstuende ein Duplikat im CRM und der Rate-Limiter dort wuerde
 * den Nachtrag ausserdem als Doppel-Submit blocken.
 */
export async function POST(req: NextRequest) {
  let body: {
    itemId?: string;
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

  const { itemId, parcelsPerMonth, costPerParcel, laborSharePct, fteEquivalent } = body;
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

  try {
    await enrichLeadWithCosts(itemId, {
      parcelsPerMonth,
      costPerParcel,
      laborSharePct,
      fteEquivalent,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('monday enrich failed', err);
    return NextResponse.json({ error: 'Nachtrag fehlgeschlagen.' }, { status: 502 });
  }
}
