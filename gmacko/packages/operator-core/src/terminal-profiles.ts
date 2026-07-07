// Terminal personalities for the OMNIDAT PAD.
//
// Every screen in OMNIDAT is authored once, as VT100 (see vt100.ts / the service
// renderers). A terminal *profile* translates that VT100 byte stream into the
// dialect of a different period terminal, so one set of screens drives many
// kinds of hardware:
//
//   vt100  — DEC VT100. ANSI CSI addressing, SGR attributes, DEC line drawing.
//            The authoring dialect; translation is the identity.
//   adm3a  — Lear Siegler ADM-3A. A glass terminal with cursor addressing but no
//            video attributes: ESC = <row+32> <col+32> to position, Ctrl-Z to
//            clear. We re-emit the rendered grid in that dialect, attributes
//            dropped.
//   tty33  — Teletype ASR-33. A *printing* terminal: no cursor addressing at all,
//            uppercase only, 72 columns, 10 cps. Full-screen pages linearize to a
//            scrolling, upper-cased transcript; there is no clear (it's paper).
//
// The translation runs the VT100 stream through our own emulator to recover the
// cell grid, then re-emits it — so DEC line-drawing already folded to ASCII and
// attributes are known per cell. Pure and deterministic.

import { Vt100Terminal } from "./vt100";

export type TerminalProfileId = "vt100" | "adm3a" | "tty33";

export interface TerminalProfile {
  id: TerminalProfileId;
  name: string;
  cols: number;
  rows: number;
  /** Can the host position the cursor (full-screen pages), or only scroll? */
  cursorAddressing: boolean;
  /** Bold / reverse / underline supported? */
  attributes: boolean;
  /** Force upper-case (the ASR-33 had no lowercase). */
  uppercaseOnly: boolean;
}

export const TERMINAL_PROFILES: Record<TerminalProfileId, TerminalProfile> = {
  vt100: {
    id: "vt100",
    name: "DEC VT100",
    cols: 80,
    rows: 24,
    cursorAddressing: true,
    attributes: true,
    uppercaseOnly: false,
  },
  adm3a: {
    id: "adm3a",
    name: "Lear Siegler ADM-3A",
    cols: 80,
    rows: 24,
    cursorAddressing: true,
    attributes: false,
    uppercaseOnly: false,
  },
  tty33: {
    id: "tty33",
    name: "Teletype ASR-33",
    cols: 72,
    rows: 24,
    cursorAddressing: false,
    attributes: false,
    uppercaseOnly: true,
  },
};

export function resolveProfile(id: string | undefined | null): TerminalProfileId {
  const key = (id ?? "").toLowerCase();
  return key === "adm3a" || key === "adm-3a"
    ? "adm3a"
    : key === "tty33" || key === "asr33" || key === "asr-33" || key === "tty"
      ? "tty33"
      : "vt100";
}

const ESC = "\x1b";
// ADM-3A control codes.
const ADM3A_CLEAR = "\x1a"; // Ctrl-Z home + clear
function adm3aCursor(row0: number, col0: number): string {
  // ESC = <row+32> <col+32>, both zero-based, clamped to printable range.
  const r = Math.max(0, Math.min(row0, 63));
  const c = Math.max(0, Math.min(col0, 63));
  return `${ESC}=${String.fromCharCode(32 + r)}${String.fromCharCode(32 + c)}`;
}

// Strip ANSI/VT100 escapes from a line-oriented stream for terminals that are
// not ANSI (ADM-3A, ASR-33). Removes CSI sequences, charset shifts, and the
// two-char escapes we emit; leaves printable text and CR/LF.
function stripAnsi(text: string): string {
  return text
    // CSI ... final-byte
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    // charset designators ESC ( X / ESC ) X
    .replace(/\x1b[()][0-9A-Za-z]/g, "")
    // standalone two-char escapes (RIS, save/restore, index…)
    .replace(/\x1b[=>78cDME]/g, "");
}

function toGrid(vt100Bytes: string): { rows: string[]; cursor: { row: number; col: number } } {
  const term = new Vt100Terminal();
  term.write(vt100Bytes.replace(/\r?\n/gu, "\r\n"));
  const screen = term.screen();
  const rows = screen.rows.map((cells) =>
    cells.map((cell) => cell.char).join("").replace(/\s+$/u, ""),
  );
  return { rows, cursor: { row: screen.cursor.row, col: screen.cursor.col } };
}

/**
 * Translate a full-screen VT100 page into a target profile's dialect. Use this
 * for cursor-addressed pages (service screens, the attract frames). Line-oriented
 * scrolling output should use {@link translateLine} instead.
 */
export function translateScreen(vt100Bytes: string, profileId: TerminalProfileId): string {
  if (profileId === "vt100") return vt100Bytes;
  const { rows, cursor } = toGrid(vt100Bytes);

  if (profileId === "adm3a") {
    let out = ADM3A_CLEAR;
    rows.forEach((line, r) => {
      if (line.length > 0) out += adm3aCursor(r, 0) + line;
    });
    out += adm3aCursor(cursor.row, cursor.col);
    return out;
  }

  // tty33 — linearize: drop trailing blank rows, upper-case, clip to 72 cols.
  const trimmed = [...rows];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") trimmed.pop();
  return `${trimmed.map((l) => l.toUpperCase().slice(0, 72)).join("\r\n")}\r\n`;
}

/**
 * Translate line-oriented scrolling output (banner, DIR/LOOKUP transcripts,
 * prompts). Glass terminals scroll it as-is (attributes stripped for the ADM-3A,
 * which is not an ANSI terminal); the ASR-33 upper-cases and clips to 72 columns.
 */
export function translateLine(text: string, profileId: TerminalProfileId): string {
  if (profileId === "vt100") return text;
  const clean = stripAnsi(text);
  if (profileId === "adm3a") return clean;
  // tty33 — upper-case; clip each physical line to 72 columns.
  return clean
    .split(/\r?\n/u)
    .map((l) => l.toUpperCase().slice(0, 72))
    .join("\r\n");
}

/** A single echoed keystroke, transformed for the profile (ASR-33 upper-cases). */
export function translateEcho(ch: string, profileId: TerminalProfileId): string {
  return profileId === "tty33" ? ch.toUpperCase() : ch;
}
