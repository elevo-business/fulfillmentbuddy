// Anbindung an monday.com CRM.
//
// Design-Prinzip: robust gegen ein unvollständig eingerichtetes Board.
// Der Verantwortliche für dieses Konto konnte per API keine Spalten anlegen
// (fehlende Berechtigung) — die strukturierten Spalten (Status, Segment,
// Bestellvolumen, ...) werden also ggf. erst nachträglich manuell im
// monday-UI ergänzt. Deshalb:
//   1) Spalten des Ziel-Boards zur Laufzeit abfragen (kurz gecacht).
//   2) column_values nur für Spalten bauen, die per Titel tatsächlich
//      existieren — fehlende werden ohne Fehler übersprungen.
//   3) Unabhängig davon werden IMMER alle Antworten als vollständiger,
//      lesbarer Kommentar (Update) am Item hinterlegt — so geht nie
//      etwas verloren, auch wenn noch keine einzige Spalte existiert.

import type { QuizAnswers } from './scoring';
import { scoreLead, statusForScore } from './scoring';

const MONDAY_API_URL = 'https://api.monday.com/v2';
const API_VERSION = '2024-10';

function apiKey(): string {
  const key = process.env.MONDAY_API_KEY;
  if (!key) {
    throw new Error(
      'MONDAY_API_KEY ist nicht gesetzt (Server-Umgebungsvariable in Coolify prüfen).'
    );
  }
  return key;
}

function boardId(): string {
  return process.env.MONDAY_BOARD_ID || '5103645238';
}

async function mondayRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey(),
      'API-Version': API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  // monday antwortet bei Auth-/Rate-Limit-Fehlern nicht immer mit sauberem
  // JSON (z.B. Cloudflare-Fehlerseite bei 5xx) — Status + Rohtext zuerst
  // sichern, damit der geloggte Fehler tatsächlich etwas aussagt, statt
  // nur "Unexpected token < in JSON" o.ä.
  const rawText = await res.text();
  let json: { data?: T; errors?: unknown };
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(
      `monday API antwortete mit Status ${res.status} und keinem gültigen JSON: ${rawText.slice(0, 300)}`
    );
  }

  if (!res.ok || json.errors) {
    throw new Error(
      `monday API error (HTTP ${res.status}): ${JSON.stringify(json.errors ?? json)}`
    );
  }
  return json.data as T;
}

type BoardColumn = { id: string; title: string; type: string };

let columnCache: { columns: BoardColumn[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minuten

async function getBoardColumns(): Promise<BoardColumn[]> {
  if (columnCache && Date.now() - columnCache.fetchedAt < CACHE_TTL_MS) {
    return columnCache.columns;
  }
  const data = await mondayRequest<{ boards: { columns: BoardColumn[] }[] }>(
    `query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns { id title type }
      }
    }`,
    { boardId: [boardId()] }
  );
  const columns = data.boards[0]?.columns ?? [];
  columnCache = { columns, fetchedAt: Date.now() };
  return columns;
}

function findColumn(columns: BoardColumn[], title: string): BoardColumn | undefined {
  return columns.find((c) => c.title.trim().toLowerCase() === title.trim().toLowerCase());
}

function digitsOnly(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

// Formatiert einen rohen String passend zum TATSÄCHLICHEN Spaltentyp auf dem
// Board — Status-Spalten erwarten { label }, alles andere (Text, Long-Text, …)
// einen einfachen String. Board-Betreiber legen die Spalten manuell im
// monday-UI an (siehe Kommentar oben) und wählen dabei frei den Typ; Code darf
// hier nicht annehmen, welcher Typ es ist.
function valueForColumn(col: BoardColumn, raw: string): unknown {
  if (col.type === 'status') return { label: raw };
  return raw;
}

async function buildColumnValues(
  answers: QuizAnswers,
  score: number
): Promise<Record<string, unknown>> {
  const columns = await getBoardColumns();
  const values: Record<string, unknown> = {};

  const set = (title: string, raw: string) => {
    const col = findColumn(columns, title);
    if (col) values[col.id] = valueForColumn(col, raw);
  };

  set('Status', statusForScore(score));
  const emailCol = findColumn(columns, 'E-Mail');
  if (emailCol) values[emailCol.id] = { email: answers.email, text: answers.email };
  if (answers.phone) {
    const phoneCol = findColumn(columns, 'Telefon');
    if (phoneCol) values[phoneCol.id] = { phone: digitsOnly(answers.phone), countryShortName: 'DE' };
  }
  set('Unternehmen', answers.company);
  set('Bestellvolumen/Monat', answers.volume);
  set('Lagerbedarf (Paletten/Monat)', answers.storage);
  set('Aktuelle Situation', answers.situation);
  set('Größte Herausforderung', answers.challenge);
  set('Dringlichkeit', answers.urgency);
  set('Lead-Score', String(score));
  if (answers.shopUrl) {
    set('Shop-Link', answers.shopUrl);
  }
  if (typeof answers.phoneVerified === 'boolean') {
    const verifiedCol = findColumn(columns, 'Telefon verifiziert');
    if (verifiedCol) values[verifiedCol.id] = { checked: answers.phoneVerified ? 'true' : 'false' };
  }

  return values;
}

function formatUpdateBody(answers: QuizAnswers, score: number): string {
  return [
    `Neuer Quiz-Lead von fulfillmentbuddy.de`,
    ``,
    `Firma: ${answers.company}`,
    `Ansprechpartner: ${answers.name}`,
    `E-Mail: ${answers.email}`,
    `Telefon: ${answers.phone}${answers.phoneVerified ? ' (SMS-verifiziert)' : ''}`,
    `Shoplink: ${answers.shopUrl || '—'}`,
    ``,
    `Bestellvolumen/Monat: ${answers.volume}`,
    `Lagerbedarf (Paletten/Monat): ${answers.storage}`,
    `Aktuelle Situation: ${answers.situation}`,
    `Größte Herausforderung: ${answers.challenge}`,
    `Dringlichkeit: ${answers.urgency}`,
    ``,
    `Lead-Score: ${score}/100 (${statusForScore(score)})`,
  ].join('\n');
}

export async function submitLeadToMonday(answers: QuizAnswers): Promise<{ itemId: string; score: number }> {
  const score = scoreLead(answers);
  const itemName = `${answers.company} — ${answers.name}`;
  const columnValues = await buildColumnValues(answers, score);

  const createData = await mondayRequest<{ create_item: { id: string } }>(
    `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(
        board_id: $boardId
        item_name: $itemName
        column_values: $columnValues
        create_labels_if_missing: true
      ) { id }
    }`,
    {
      boardId: boardId(),
      itemName,
      columnValues: JSON.stringify(columnValues),
    }
  );

  const itemId = createData.create_item.id;

  // Vollständige Antworten immer zusätzlich als Update hinterlegen —
  // unabhängig davon, welche Spalten gerade existieren.
  await mondayRequest(
    `mutation ($itemId: ID!, $body: String!) {
      create_update(item_id: $itemId, body: $body) { id }
    }`,
    { itemId, body: formatUpdateBody(answers, score) }
  );

  return { itemId, score };
}
