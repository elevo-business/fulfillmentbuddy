import { NextRequest, NextResponse } from 'next/server';
import { checkPhoneVerification, normalizeGermanE164 } from '@/lib/twilioVerify';

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  const phone = (body.phone || '').trim();
  const code = (body.code || '').trim();
  if (!phone || !code) {
    return NextResponse.json({ error: 'Telefonnummer und Code erforderlich.' }, { status: 400 });
  }
  const e164 = normalizeGermanE164(phone);

  try {
    const verified = await checkPhoneVerification(e164, code);
    return NextResponse.json({ ok: true, verified });
  } catch (err) {
    console.error('twilio verify check failed', err);
    return NextResponse.json(
      { error: 'Prüfung fehlgeschlagen. Versuch es gleich nochmal.' },
      { status: 502 }
    );
  }
}
