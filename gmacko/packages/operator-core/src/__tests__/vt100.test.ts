import { describe, expect, it } from "vitest";

import {
  VT100_COLS,
  VT100_ROWS,
  Vt100Terminal,
  renderVt100Screen,
  renderVt100Text,
} from "../vt100";

const ESC = "\x1b";

describe("Vt100Terminal", () => {
  it("starts as a blank 80x24 screen with the cursor at home", () => {
    const term = new Vt100Terminal();
    const screen = term.screen();
    expect(screen.cols).toBe(VT100_COLS);
    expect(screen.rows_count).toBe(VT100_ROWS);
    expect(screen.rows).toHaveLength(24);
    expect(screen.rows[0]).toHaveLength(80);
    expect(screen.cursor).toEqual({ row: 0, col: 0, visible: true });
    expect(term.toText()).toBe("");
  });

  it("writes plain text and advances the cursor", () => {
    const term = new Vt100Terminal();
    term.write("OMNIDAT");
    expect(term.toText()).toBe("OMNIDAT");
    expect(term.screen().cursor.col).toBe(7);
  });

  it("treats CRLF as carriage-return + line-feed", () => {
    const term = new Vt100Terminal();
    term.write("READY\r\nGO");
    expect(term.toText()).toBe("READY\nGO");
    expect(term.screen().cursor).toMatchObject({ row: 1, col: 2 });
  });

  it("moves the cursor to an absolute position with CUP (ESC[r;cH)", () => {
    const term = new Vt100Terminal();
    term.write(`${ESC}[5;10HX`);
    const screen = term.screen();
    // CUP is 1-based; row 5 col 10 -> index 4,9. X lands there, cursor moves +1.
    expect(screen.rows[4][9].char).toBe("X");
    expect(screen.cursor).toMatchObject({ row: 4, col: 10 });
  });

  it("applies SGR bold and reverse attributes to cells", () => {
    const term = new Vt100Terminal();
    term.write(`${ESC}[1;7mHI${ESC}[0mLO`);
    const screen = term.screen();
    expect(screen.rows[0][0].attr).toMatchObject({ bold: true, reverse: true });
    expect(screen.rows[0][1].attr).toMatchObject({ bold: true, reverse: true });
    // After the reset the following glyphs carry default attributes.
    expect(screen.rows[0][2].attr).toMatchObject({ bold: false, reverse: false });
  });

  it("clears the screen with ED mode 2 (ESC[2J)", () => {
    const term = new Vt100Terminal();
    term.write(`GARBAGE${ESC}[2J`);
    expect(term.toText()).toBe("");
  });

  it("erases to end of line with EL (ESC[K)", () => {
    const term = new Vt100Terminal();
    term.write(`ABCDEF${ESC}[4D${ESC}[K`);
    // After 6 chars cursor at col6, CUB 4 -> col2, erase to EOL leaves "AB".
    expect(term.toText()).toBe("AB");
  });

  it("scrolls up when output runs past the last row", () => {
    const term = new Vt100Terminal();
    for (let i = 0; i < 30; i += 1) term.write(`L${i}\r\n`);
    const text = term.toText().split("\n");
    // Trailing blank rows are trimmed, so the last visible line is L29's row.
    expect(text[text.length - 1]).toBe("L29");
    // The earliest lines scrolled off the top of the 24-row screen.
    expect(term.toText()).not.toContain("L0\n");
    expect(term.toText()).not.toContain("L5\n");
  });

  it("honors hide/show cursor (DECTCEM ESC[?25l / ESC[?25h)", () => {
    const term = new Vt100Terminal();
    term.write(`${ESC}[?25l`);
    expect(term.screen().cursor.visible).toBe(false);
    term.write(`${ESC}[?25h`);
    expect(term.screen().cursor.visible).toBe(true);
  });

  it("latches and clears the bell on BEL (0x07)", () => {
    const term = new Vt100Terminal();
    term.write("DING\x07");
    expect(term.screen().bell).toBe(true);
    // The latch clears once read.
    expect(term.screen().bell).toBe(false);
  });

  it("performs a full reset on RIS (ESC c)", () => {
    const term = new Vt100Terminal();
    term.write(`${ESC}[1mBOLD${ESC}cFRESH`);
    const screen = term.screen();
    expect(term.toText()).toBe("FRESH");
    expect(screen.rows[0][0].attr.bold).toBe(false);
  });

  it("folds DEC line-drawing glyphs to ASCII when G0 graphics are selected", () => {
    const term = new Vt100Terminal();
    // ESC(0 selects the special graphics set; q -> horizontal line.
    term.write(`${ESC}(0qqq${ESC}(B`);
    expect(term.toText()).toBe("---");
  });

  it("auto-wraps past column 80 onto the next row", () => {
    const term = new Vt100Terminal();
    term.write("X".repeat(85));
    const screen = term.screen();
    expect(screen.rows[0].every((c) => c.char === "X")).toBe(true);
    expect(screen.rows[1][0].char).toBe("X");
    expect(screen.rows[1][4].char).toBe("X");
    expect(screen.rows[1][5].char).toBe(" ");
  });
});

describe("renderVt100Text / renderVt100Screen", () => {
  it("normalizes bare LF transcripts to land at column 0", () => {
    const text = renderVt100Text("CONNECT MILLIWAYS\nSTATUS UP\nCLR DTE C:0 D:0");
    expect(text).toBe("CONNECT MILLIWAYS\nSTATUS UP\nCLR DTE C:0 D:0");
  });

  it("produces a serialized screen with cursor state", () => {
    const screen = renderVt100Screen("PAD>");
    expect(screen.rows[0][0].char).toBe("P");
    expect(screen.cursor.col).toBe(4);
  });

  it("is deterministic — identical input yields identical screens", () => {
    const a = renderVt100Text(`${ESC}[1mHELLO${ESC}[0m\nWORLD`);
    const b = renderVt100Text(`${ESC}[1mHELLO${ESC}[0m\nWORLD`);
    expect(a).toBe(b);
  });
});
