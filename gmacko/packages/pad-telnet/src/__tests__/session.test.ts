import { describe, expect, it } from "vitest";

import { renderVt100Text } from "@omnidat/operator-core/vt100";

import { PadSession } from "../session.js";

/** Feed a full command line (adds CR) and return the output bytes. */
function line(session: PadSession, cmd: string) {
  return session.feed(`${cmd}\r`).output;
}

describe("PadSession", () => {
  it("greets with a reset, banner, and prompt", () => {
    const s = new PadSession();
    const greeting = s.greeting();
    expect(greeting.startsWith("\x1bc")).toBe(true); // RIS
    expect(renderVt100Text(greeting)).toContain("OMNIDAT");
    expect(greeting).toContain("PAD>");
  });

  it("echoes printable characters as they are typed", () => {
    const s = new PadSession();
    expect(s.feed("DI").output).toBe("DI");
  });

  it("handles backspace by erasing the last character", () => {
    const s = new PadSession();
    s.feed("DIRX");
    expect(s.feed("\x7f").output).toBe("\b \b"); // DEL erases the X
  });

  it("strips telnet IAC negotiation without leaking it into the line", () => {
    const s = new PadSession();
    // IAC WILL ECHO (0xff 0xfb 0x01) then the literal "DIR".
    const out = s.feed(Buffer.from([0xff, 0xfb, 0x01, 0x44, 0x49, 0x52])).output;
    expect(out).toBe("DIR");
  });

  it("runs DIR through the shared XOT command engine", () => {
    const s = new PadSession();
    const out = line(s, "DIR");
    expect(renderVt100Text(out)).toContain("311088");
  });

  it("enters an interactive session on CALL and renders the service screen", () => {
    const s = new PadSession();
    const out = line(s, "CALL 311088020501");
    const text = renderVt100Text(out);
    expect(text).toContain("MILIWAYS ORDER ENTRY");
    // Now in session mode, MENU renders the menu.
    const menu = renderVt100Text(line(s, "MENU"));
    expect(menu).toContain("NOODLE CUP");
  });

  it("returns to the PAD when the session clears", () => {
    const s = new PadSession();
    line(s, "CALL 311088020501");
    const out = line(s, "CLEAR");
    expect(renderVt100Text(out)).toContain("SESSION CLEARED");
    // Back at the PAD: DIR works again as a read verb.
    expect(renderVt100Text(line(s, "DIR"))).toContain("311088");
  });

  it("clears an unknown address with an honest cause but stays connected", () => {
    const s = new PadSession();
    const out = line(s, "CALL 311088099999");
    expect(renderVt100Text(out)).toContain("CLR NP C:13 D:67");
    // Still at the PAD (not closed) — HELP still answers.
    expect(line(s, "HELP").length).toBeGreaterThan(0);
  });

  it("signals close on CLEAR at the PAD", () => {
    const s = new PadSession();
    const result = s.feed("CLEAR\r");
    expect(result.close).toBe(true);
    expect(renderVt100Text(result.output)).toContain("CLR DTE C:0 D:0");
  });

  it("signals attract on the ATTRACT verb", () => {
    const s = new PadSession();
    const result = s.feed("ATTRACT\r");
    expect(result.startAttract).toBe(true);
  });

  it("prints the verb list on HELP", () => {
    const s = new PadSession();
    expect(line(s, "HELP")).toContain("VERBS:");
  });
});
