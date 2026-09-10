import { NextRequest, NextResponse } from 'next/server';
import { startPhoneVerification, normalizeGermanE164 } from '@/lib/twilioVerify';

// Eigener, kurzer Rate-Limiter (getrennt vom /api/submit-Limiter) — OTP-Sends
// kosten pro SMS echtes Geld bei Twilio, daher enger begrenzt: sowohl pro
// Telefonnummer als auch pro IP.
const recentSends = new Map<string, number>();
const WINDOW_MS = 45_000;

function isRateLimited(key: string): boolean {
  const last = recentSends.get(key);
  const now = Date.now();
  if (last && now - last < WINDOW_MS) return true;
  recentSends.set(key, now);
  if (recentSends.size > 2000) {
    const cutoff = now - WINDOW_MS;
    for (const [k, ts] of recentSends) if (ts < cutoff) recentSends.delete(k);
  }
  return false;
}

export async function POST(req: NextRequest) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  const phone = (body.phone || '').trim();
  if (!phone) {
    return NextResponse.json({ error: 'Telefonnummer fehlt.' }, { status: 400 });
  }
  const e164 = normalizeGermanE164(phone);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(e164) || isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Bitte kurz warten, bevor du einen neuen Code anforderst.' },
      { status: 429 }
    );
  }

  try {
    await startPhoneVerification(e164);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('twilio verify send failed', err);
    return NextResponse.json(
      { error: 'Code konnte nicht gesendet werden. Prüf die Nummer oder versuch es gleich nochmal.' },
      { status: 502 }
    );
  }
}
