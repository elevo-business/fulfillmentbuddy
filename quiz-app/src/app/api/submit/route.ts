import { NextRequest, NextResponse } from 'next/server';
import { submitLeadToMonday } from '@/lib/monday';
import type { QuizAnswers } from '@/lib/scoring';

const REQUIRED_FIELDS: (keyof QuizAnswers)[] = [
  'segment',
  'volume',
  'storage',
  'situation',
  'challenge',
  'urgency',
  'name',
  'company',
  'email',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sehr einfacher In-Memory-Rate-Limiter (pro Server-Instanz) gegen
// versehentliches Doppel-Submit / grobe Spam-Bots. Kein Ersatz für einen
// echten WAF-Schutz, aber ausreichend für einen Low-Traffic-B2B-Funnel.
const recentSubmissions = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const last = recentSubmissions.get(ip);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_WINDOW_MS) return true;
  recentSubmissions.set(ip, now);
  // simple cleanup to avoid unbounded growth
  if (recentSubmissions.size > 1000) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    for (const [key, ts] of recentSubmissions) {
      if (ts < cutoff) recentSubmissions.delete(key);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Zu viele Anfragen, bitte kurz warten.' }, { status: 429 });
  }

  let body: Partial<QuizAnswers>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || String(body[field]).trim() === '') {
      return NextResponse.json({ error: `Feld fehlt: ${field}` }, { status: 400 });
    }
  }
  if (!EMAIL_RE.test(body.email!)) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 });
  }

  // Honeypot: unsichtbares Feld, das nur Bots ausfüllen.
  if ((body as Record<string, unknown>).website) {
    return NextResponse.json({ ok: true }); // still 200, aber wir tun nichts
  }

  try {
    const { score } = await submitLeadToMonday(body as QuizAnswers);
    return NextResponse.json({ ok: true, score });
  } catch (err) {
    console.error('monday submit failed', err);
    return NextResponse.json(
      { error: 'Übermittlung fehlgeschlagen. Bitte später erneut versuchen.' },
      { status: 502 }
    );
  }
}
