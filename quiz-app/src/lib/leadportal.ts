// Weiterleitung von Quiz-Leads an das Lead Routing Portal
// (leadroutingportal, POST /api/v1/leads/inbound).
//
// Das Portal ist eine ZWEITSENKE neben HubSpot: Dort laufen Routing an
// Kunden, Pay-per-Lead-Abrechnung und der Meta-CAPI-Feedback-Loop
// (QualifiedLead-Event, wenn ein Kunde den Lead qualifiziert).
//
// Aktivierung ausschliesslich ueber LEADPORTAL_API_KEY (= INBOUND_API_KEY
// der Portal-App). Ohne Key ist die Weiterleitung schlicht deaktiviert —
// der CRM-Weg bleibt davon unberuehrt.
//
// Fehlerduesung: Der Aufrufer faengt Fehler ab und loggt sie nur. Ein
// Lead, der im CRM liegt, darf an einer nicht erreichbaren Zweitsenke
// niemals scheitern.

import type { QuizAnswers } from './scoring';
import { scoreLead, intentTier, leadBlockers, statusForLead } from './scoring';
import type { LeadAttribution } from './hubspot';

export function isLeadPortalConfigured(): boolean {
  return Boolean(process.env.LEADPORTAL_API_KEY);
}

function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstname: parts[0], lastname: '' };
  return { firstname: parts.slice(0, -1).join(' '), lastname: parts[parts.length - 1] };
}

/**
 * fbclid aus der Einstiegs-URL ziehen, falls der Klick ueber eine Meta-
 * Anzeige kam. Das Portal braucht sie fuer den CAPI-Feedback-Loop
 * (user_data.fbc), sobald der Lead qualifiziert wird.
 */
function extractFbclid(landingUrl?: string): string | null {
  if (!landingUrl) return null;
  try {
    return new URL(landingUrl).searchParams.get('fbclid');
  } catch {
    return null;
  }
}

export async function forwardLeadToPortal(
  answers: QuizAnswers,
  options: { suspectedBot?: boolean; attribution?: LeadAttribution } = {}
): Promise<void> {
  const apiKey = process.env.LEADPORTAL_API_KEY;
  if (!apiKey) return;

  const baseUrl = (process.env.LEADPORTAL_URL || 'https://leads.elevo.solutions').replace(
    /\/+$/,
    ''
  );
  const clientId = process.env.LEADPORTAL_CLIENT_ID || undefined;

  const score = scoreLead(answers);
  const blockers = leadBlockers(answers);
  const { firstname, lastname } = splitName(answers.name);
  const attribution = options.attribution ?? {};

  const payload = {
    first_name: firstname || null,
    last_name: lastname || null,
    email: answers.email,
    phone: answers.phone || null,
    source: 'landingpage',
    fbclid: extractFbclid(attribution.landingUrl),
    // Ohne LEADPORTAL_CLIENT_ID bleibt der Lead unzugewiesen und wird im
    // Admin-Bereich des Portals geroutet.
    ...(clientId ? { client_id: clientId } : {}),
    custom_data: {
      company: answers.company,
      shop_url: answers.shopUrl || null,
      quiz: {
        rolle: answers.role,
        bestellungen_pro_monat: answers.volume,
        fulfillment_aktuell: answers.process,
        zeitaufwand_pro_woche: answers.timeSpent,
        groesste_herausforderung: answers.challenge,
        wachstumsziel_12_monate: answers.growth,
      },
      lead_score: score,
      intent: intentTier(answers),
      quiz_status: statusForLead(answers, score),
      ausschlussgruende: blockers,
      phone_verified: answers.phoneVerified ?? false,
      suspected_bot: Boolean(options.suspectedBot),
      // Rechnerwerte kommen nur mit, wenn der Nutzer den Paketkosten-
      // Rechner vor dem Absenden benutzt hat (Quiz.tsx schickt sie dann
      // direkt im Submit-Body mit).
      ...(answers.parcelsPerMonth !== undefined
        ? {
            rechner: {
              pakete_pro_monat: answers.parcelsPerMonth,
              kosten_pro_paket: answers.costPerParcel ?? null,
              personalanteil_prozent: answers.laborSharePct ?? null,
              vollzeitstellen: answers.fteEquivalent ?? null,
            },
          }
        : {}),
      herkunft: {
        utm_source: attribution.utmSource ?? null,
        utm_medium: attribution.utmMedium ?? null,
        utm_campaign: attribution.utmCampaign ?? null,
        utm_content: attribution.utmContent ?? null,
        utm_term: attribution.utmTerm ?? null,
        landing_url: attribution.landingUrl ?? null,
        referrer: attribution.referrer ?? null,
      },
    },
  };

  const res = await fetch(`${baseUrl}/api/v1/leads/inbound`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Lead Routing Portal → Status ${res.status}: ${text.slice(0, 300)}`);
  }
}
