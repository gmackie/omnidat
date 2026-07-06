// VT100 terminal emulation for the OMNIDAT operator surface.
//
// A dependency-free, deterministic DEC VT100 screen-buffer emulator. It parses
// the subset of ANSI/VT100 control functions that period X.25 hosts actually
// emitted — cursor movement, erase, and SGR (Select Graphic Rendition) — into
// an 80x24 cell grid. The same module runs server-side (canonical screen state
// + audit) and client-side (live local echo), so what the operator sees is what
// the emulator produced, not an approximation.
//
// Reference: DEC STD 070 / VT100 User Guide, ANSI X3.64. We implement the
// control functions a text-only packet host needs; graphics-set (DEC line
// drawing) glyphs are mapped to their nearest ASCII so transcripts stay legible.

export const VT100_COLS = 80;
export const VT100_ROWS = 24;

/** SGR attributes carried by every cell. */
export interface Vt100Attr {
  bold: boolean;
  dim: boolean;
  underline: boolean;
  blink: boolean;
  reverse: boolean;
}

export interface Vt100Cell {
  char: string;
  attr: Vt100Attr;
}

/** A serialized screen: 24 rows of 80 cells, plus cursor + bell state. */
export interface Vt100Screen {
  rows: Vt100Cell[][];
  cursor: { row: number; col: number; visible: boolean };
  bell: boolean;
  cols: number;
  rows_count: number;
}

const DEFAULT_ATTR: Vt100Attr = {
  bold: false,
  dim: false,
  underline: false,
  blink: false,
  reverse: false,
};

function cloneAttr(a: Vt100Attr): Vt100Attr {
  return { ...a };
}

function blankCell(): Vt100Cell {
  return { char: " ", attr: cloneAttr(DEFAULT_ATTR) };
}

// DEC special graphics (line drawing) charset — the glyphs a VT100 would draw
// when ESC(0 is active. We fold them to ASCII so text hosts remain readable.
const DEC_GRAPHICS: Record<string, string> = {
  j: "+", k: "+", l: "+", m: "+", n: "+", // corners + cross
  q: "-", x: "|", // horizontal / vertical
  t: "+", u: "+", v: "+", w: "+", // tees
  "`": "*", a: "#", "~": "·", o: "-", s: "_",
};

/**
 * A VT100 terminal. Feed it bytes with `write()`; read the screen with
 * `screen()` or a human-facing string with `toText()`. Deterministic: no
 * timers, no randomness — identical input yields identical screen state.
 */
export class Vt100Terminal {
  readonly cols: number;
  readonly rows: number;
  private grid: Vt100Cell[][];
  private curRow = 0;
  private curCol = 0;
  private attr: Vt100Attr = cloneAttr(DEFAULT_ATTR);
  private savedRow = 0;
  private savedCol = 0;
  private cursorVisible = true;
  private bellPending = false;
  private graphicsG0 = false;
  // Parser state
  private pending = ""; // accumulates a CSI/ESC sequence until it terminates
  private inEscape = false;

  constructor(cols = VT100_COLS, rows = VT100_ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.grid = this.freshGrid();
  }

  private freshGrid(): Vt100Cell[][] {
    return Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => blankCell()),
    );
  }

  /** Hard reset (RIS, ESC c): blank screen, home cursor, default attrs. */
  reset(): void {
    this.grid = this.freshGrid();
    this.curRow = 0;
    this.curCol = 0;
    this.attr = cloneAttr(DEFAULT_ATTR);
    this.cursorVisible = true;
    this.graphicsG0 = false;
    this.pending = "";
    this.inEscape = false;
  }

  /** Feed a chunk of output through the parser. */
  write(input: string): this {
    for (const ch of input) {
      if (this.inEscape) {
        this.consumeEscape(ch);
        continue;
      }
      const code = ch.codePointAt(0)!;
      if (ch === "\x1b") {
        this.inEscape = true;
        this.pending = "";
        continue;
      }
      if (code < 0x20) {
        this.control(ch);
        continue;
      }
      this.putChar(ch);
    }
    return this;
  }

  private control(ch: string): void {
    switch (ch) {
      case "\r": // CR
        this.curCol = 0;
        break;
      case "\n": // LF
      case "\x0b": // VT
      case "\x0c": // FF
        this.lineFeed();
        break;
      case "\b": // BS
        if (this.curCol > 0) this.curCol -= 1;
        break;
      case "\t": { // HT — advance to next 8-col tab stop
        const next = Math.min(this.cols - 1, (Math.floor(this.curCol / 8) + 1) * 8);
        this.curCol = next;
        break;
      }
      case "\x07": // BEL
        this.bellPending = true;
        break;
      default:
        break; // ignore other C0 controls
    }
  }

  private lineFeed(): void {
    this.curRow += 1;
    if (this.curRow >= this.rows) {
      this.scrollUp();
      this.curRow = this.rows - 1;
    }
  }

  private scrollUp(): void {
    this.grid.shift();
    this.grid.push(Array.from({ length: this.cols }, () => blankCell()));
  }

  private putChar(ch: string): void {
    let glyph = ch;
    const mapped = DEC_GRAPHICS[ch];
    if (this.graphicsG0 && mapped) glyph = mapped;
    if (this.curCol >= this.cols) {
      // Auto-wrap: emulate VT100 DECAWM (default on).
      this.curCol = 0;
      this.lineFeed();
    }
    const row = this.grid[this.curRow];
    if (!row) return;
    row[this.curCol] = {
      char: glyph,
      attr: cloneAttr(this.attr),
    };
    this.curCol += 1;
  }

  // ---- Escape / CSI parsing --------------------------------------------

  private consumeEscape(ch: string): void {
    // Two-char escapes that don't start a CSI.
    if (this.pending === "") {
      if (ch === "[") {
        this.pending = "[";
        return;
      }
      if (ch === "c") {
        // RIS — full reset
        this.reset();
        this.inEscape = false;
        return;
      }
      if (ch === "7") {
        this.savedRow = this.curRow;
        this.savedCol = this.curCol;
        this.inEscape = false;
        return;
      }
      if (ch === "8") {
        this.curRow = this.savedRow;
        this.curCol = this.savedCol;
        this.inEscape = false;
        return;
      }
      if (ch === "D") {
        this.lineFeed();
        this.inEscape = false;
        return;
      }
      if (ch === "M") {
        // Reverse line feed
        this.curRow = Math.max(0, this.curRow - 1);
        this.inEscape = false;
        return;
      }
      if (ch === "(" || ch === ")") {
        this.pending = ch; // charset designator; next char picks the set
        return;
      }
      // Unknown 2-char escape — drop it.
      this.inEscape = false;
      return;
    }

    // Charset designation: ESC ( X  /  ESC ) X
    if (this.pending === "(" || this.pending === ")") {
      if (this.pending === "(") this.graphicsG0 = ch === "0";
      this.inEscape = false;
      this.pending = "";
      return;
    }

    // CSI: ESC [ ... final-byte (0x40-0x7e)
    const code = ch.codePointAt(0)!;
    if (code >= 0x40 && code <= 0x7e) {
      this.dispatchCsi(this.pending.slice(1), ch);
      this.inEscape = false;
      this.pending = "";
      return;
    }
    this.pending += ch;
  }

  private dispatchCsi(params: string, final: string): void {
    const priv = params.startsWith("?");
    const raw = priv ? params.slice(1) : params;
    const nums = raw
      .split(";")
      .map((p) => (p === "" ? NaN : Number(p)));
    const arg = (i: number, def: number): number => {
      const v = nums[i];
      return Number.isNaN(v) || v === undefined ? def : v;
    };

    switch (final) {
      case "A": // CUU — cursor up
        this.curRow = Math.max(0, this.curRow - arg(0, 1));
        break;
      case "B": // CUD — cursor down
        this.curRow = Math.min(this.rows - 1, this.curRow + arg(0, 1));
        break;
      case "C": // CUF — cursor forward
        this.curCol = Math.min(this.cols - 1, this.curCol + arg(0, 1));
        break;
      case "D": // CUB — cursor back
        this.curCol = Math.max(0, this.curCol - arg(0, 1));
        break;
      case "G": // CHA — cursor to column
        this.curCol = this.clampCol(arg(0, 1) - 1);
        break;
      case "d": // VPA — cursor to row
        this.curRow = this.clampRow(arg(0, 1) - 1);
        break;
      case "H": // CUP — cursor position
      case "f": // HVP
        this.curRow = this.clampRow(arg(0, 1) - 1);
        this.curCol = this.clampCol(arg(1, 1) - 1);
        break;
      case "J": // ED — erase in display
        this.eraseDisplay(arg(0, 0));
        break;
      case "K": // EL — erase in line
        this.eraseLine(arg(0, 0));
        break;
      case "m": // SGR — set graphic rendition
        this.applySgr(raw === "" ? [0] : nums.map((n) => (Number.isNaN(n) ? 0 : n)));
        break;
      case "h": // SM / DECSET
        if (priv && arg(0, 0) === 25) this.cursorVisible = true;
        break;
      case "l": // RM / DECRST
        if (priv && arg(0, 0) === 25) this.cursorVisible = false;
        break;
      case "s": // save cursor (ANSI)
        this.savedRow = this.curRow;
        this.savedCol = this.curCol;
        break;
      case "u": // restore cursor (ANSI)
        this.curRow = this.savedRow;
        this.curCol = this.savedCol;
        break;
      default:
        break; // silently ignore unsupported CSI
    }
  }

  private clampRow(r: number): number {
    return Math.max(0, Math.min(this.rows - 1, r));
  }
  private clampCol(c: number): number {
    return Math.max(0, Math.min(this.cols - 1, c));
  }

  private eraseDisplay(mode: number): void {
    if (mode === 2 || mode === 3) {
      this.grid = this.freshGrid();
      return;
    }
    if (mode === 0) {
      // cursor to end of screen
      this.eraseLine(0);
      for (let r = this.curRow + 1; r < this.rows; r += 1) {
        this.grid[r] = Array.from({ length: this.cols }, () => blankCell());
      }
    } else if (mode === 1) {
      // start of screen to cursor
      for (let r = 0; r < this.curRow; r += 1) {
        this.grid[r] = Array.from({ length: this.cols }, () => blankCell());
      }
      this.eraseLine(1);
    }
  }

  private eraseLine(mode: number): void {
    const row = this.grid[this.curRow];
    if (!row) return;
    const from = mode === 0 ? this.curCol : 0;
    const to = mode === 1 ? this.curCol : this.cols - 1;
    for (let c = from; c <= to; c += 1) row[c] = blankCell();
  }

  private applySgr(codes: number[]): void {
    for (const code of codes) {
      switch (code) {
        case 0:
          this.attr = cloneAttr(DEFAULT_ATTR);
          break;
        case 1:
          this.attr.bold = true;
          break;
        case 2:
          this.attr.dim = true;
          break;
        case 4:
          this.attr.underline = true;
          break;
        case 5:
          this.attr.blink = true;
          break;
        case 7:
          this.attr.reverse = true;
          break;
        case 22:
          this.attr.bold = false;
          this.attr.dim = false;
          break;
        case 24:
          this.attr.underline = false;
          break;
        case 25:
          this.attr.blink = false;
          break;
        case 27:
          this.attr.reverse = false;
          break;
        default:
          break; // color codes (30-47) intentionally ignored — monochrome phosphor
      }
    }
  }

  // ---- Output ----------------------------------------------------------

  /** Snapshot the screen for transport/rendering. Clears the bell latch. */
  screen(): Vt100Screen {
    const bell = this.bellPending;
    this.bellPending = false;
    return {
      rows: this.grid.map((row) => row.map((cell) => ({
        char: cell.char,
        attr: cloneAttr(cell.attr),
      }))),
      cursor: { row: this.curRow, col: this.curCol, visible: this.cursorVisible },
      bell,
      cols: this.cols,
      rows_count: this.rows,
    };
  }

  /** Human-facing plain text, trailing blank rows trimmed. */
  toText(): string {
    const lines = this.grid.map((row) =>
      row.map((cell) => cell.char).join("").replace(/\s+$/u, ""),
    );
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }
}

/**
 * Render a transcript string through a fresh VT100 into a text screen. Newlines
 * in transcripts are normalized to CRLF so hosts that emit bare LF still land at
 * column 0 (a real VT100 in its default mode would not).
 */
export function renderVt100Text(transcript: string, cols = VT100_COLS, rows = VT100_ROWS): string {
  const term = new Vt100Terminal(cols, rows);
  term.write(transcript.replace(/\r?\n/gu, "\r\n"));
  return term.toText();
}

/** Render a transcript to a full serialized screen (for the client UI). */
export function renderVt100Screen(transcript: string, cols = VT100_COLS, rows = VT100_ROWS): Vt100Screen {
  const term = new Vt100Terminal(cols, rows);
  term.write(transcript.replace(/\r?\n/gu, "\r\n"));
  return term.screen();
}

// ---- OMNIDAT presentation helpers --------------------------------------
//
// These emit escape-laden strings the emulator renders identically on server
// and client, so the CRT look is defined once, in code, not in CSS guesswork.

const CSI = "\x1b[";
/** Wrap text in an SGR run, always resetting afterwards. */
export function sgr(text: string, ...codes: number[]): string {
  return `${CSI}${codes.join(";")}m${text}${CSI}0m`;
}

/**
 * The connect-time login banner an operator sees on a fresh VT100 session:
 * a reverse-video title bar, the exchange identity, and the interactive prompt.
 * Emitted as CRLF-terminated lines with VT100 escapes.
 */
export function buildOmnidatLoginBanner(input: {
  x121: string;
  exchange?: string;
  operator?: string;
}): string {
  const exchange = input.exchange ?? "EXCHANGE 88";
  const bar = sgr(
    " OMNIDAT PACKET SWITCHED NETWORK — X.25 ".padEnd(VT100_COLS, " "),
    7,
    1,
  );
  const lines = [
    bar,
    "",
    `  ${sgr("OMNIDAT", 1)} ${exchange}  DTE ${input.x121}`,
    "  ASYNCHRONOUS PAD — CCITT X.28 / X.29 SIGNALLING",
    input.operator ? `  OPERATOR ${input.operator.toUpperCase()}` : "  GUEST TERMINAL",
    "",
    `  ${sgr("CONNECTED.", 1)} TYPE ${sgr("HELP", 4)} FOR VERBS, ${sgr("CLEAR", 4)} TO HANG UP.`,
    "",
  ];
  return lines.join("\r\n");
}

/** The interactive PAD prompt string (no trailing newline). */
export function omnidatPrompt(x121: string): string {
  return `${sgr(x121, 1)} PAD> `;
}
