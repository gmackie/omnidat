// Camp Status Board app (H3 camp utility).
//
// The status board (board_id STATUS, e.g. 020010) is a plain message board with
// a controlled vocabulary layered on top: campsites post their current state
// using standard status codes (docs field-office plan) plus free detail. Posts
// are normalized so a known code is upper-cased and separated from its detail,
// and unknown codes still post verbatim (the board never rejects a shout).

/** Standard status vocabulary (canonical, longest-first for greedy matching). */
export const CAMP_STATUS_CODES = [
  "RADIO OPERATOR AVAILABLE",
  "WORKSHOP AT",
  "QUIET HOURS",
  "NEED SUPPLIES",
  "NEED PARTS",
  "NEED HELP",
  "NEED ICE",
  "CLOSED",
  "OPEN",
] as const;

export function isStatusBoard(boardId: string): boolean {
  return boardId.toUpperCase() === "STATUS";
}

/** One-line help listing the vocabulary for the board prompt. */
export function statusHelp(): string {
  return `STATUS CODES: OPEN, CLOSED, QUIET HOURS, NEED ICE, NEED PARTS, NEED HELP, NEED SUPPLIES, WORKSHOP AT <TIME>, RADIO OPERATOR AVAILABLE`;
}

export interface NormalizedStatus {
  code: string | null;
  detail: string;
  known: boolean;
  /** The body to post: "CODE — detail", or the raw text if no code matched. */
  formatted: string;
}

/** Normalize a status post: match a leading known code, split off the detail. */
export function normalizeStatusPost(body: string): NormalizedStatus {
  const trimmed = body.trim();
  const upper = trimmed.toUpperCase();
  for (const code of CAMP_STATUS_CODES) {
    if (upper === code || upper.startsWith(`${code} `)) {
      const detail = trimmed.slice(code.length).trim();
      return {
        code,
        detail,
        known: true,
        formatted: detail ? `${code} — ${detail}` : code,
      };
    }
  }
  return { code: null, detail: trimmed, known: false, formatted: trimmed };
}
