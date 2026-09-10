// Twilio Verify (SMS-OTP) — Telefonnummern-Verifizierung im Quiz.
// Reine REST-Calls gegen die Twilio-API, kein Twilio-SDK-Paket — passt zur
// Projekt-Konvention (siehe monday.ts: raw fetch() statt Client-Library, um
// keine zusätzliche Runtime-Dependency für einen einzelnen Anbieter zu
// ziehen). API-Referenz: https://www.twilio.com/docs/verify/api

const TWILIO_API = 'https://verify.twilio.com/v2';

function credentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) {
    throw new Error(
      'Twilio-Umgebungsvariablen fehlen (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID) — in Coolify prüfen.'
    );
  }
  return { accountSid, authToken, serviceSid };
}

function authHeader(accountSid: string, authToken: string): string {
  return 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
}

// Best-effort-Normalisierung auf E.164 — Twilio verlangt das Format
// (+<Ländervorwahl><Nummer>, keine Leerzeichen). Zielgruppe ist DACH, daher
// deutscher Default (0151... → +49151...), analog zur countryShortName:'DE'-
// Annahme, die im monday-Telefon-Feld schon existiert.
export function normalizeGermanE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('0')) return '+49' + digits.slice(1);
  return '+49' + digits;
}

export async function startPhoneVerification(phoneE164: string): Promise<void> {
  const { accountSid, authToken, serviceSid } = credentials();
  const res = await fetch(`${TWILIO_API}/Services/${serviceSid}/Verifications`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(accountSid, authToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: phoneE164, Channel: 'sms' }),
  });
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new Error(`Twilio Verify (Start) fehlgeschlagen: ${(data as { message?: string }).message || res.status}`);
  }
}

export async function checkPhoneVerification(phoneE164: string, code: string): Promise<boolean> {
  const { accountSid, authToken, serviceSid } = credentials();
  const res = await fetch(`${TWILIO_API}/Services/${serviceSid}/VerificationCheck`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(accountSid, authToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: phoneE164, Code: code }),
  });
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    // 404 = keine laufende Verifizierung mehr (abgelaufen/falscher Code
    // schon zu oft versucht) — als "nicht verifiziert" behandeln, kein Crash.
    if (res.status === 404) return false;
    throw new Error(`Twilio Verify (Check) fehlgeschlagen: ${(data as { message?: string }).message || res.status}`);
  }
  return (data as { status?: string }).status === 'approved';
}
