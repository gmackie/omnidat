import { describe, expect, it } from "vitest";

import { connectServiceScreen } from "../omnidat-terminal";
import {
  TERMINAL_PROFILES,
  resolveProfile,
  translateEcho,
  translateLine,
  translateScreen,
} from "../terminal-profiles";
import { Vt100Page, sgr } from "../vt100";

describe("resolveProfile", () => {
  it("maps aliases and defaults unknown ids to vt100", () => {
    expect(resolveProfile("adm3a")).toBe("adm3a");
    expect(resolveProfile("ADM-3A")).toBe("adm3a");
    expect(resolveProfile("asr33")).toBe("tty33");
    expect(resolveProfile("tty")).toBe("tty33");
    expect(resolveProfile("vt100")).toBe("vt100");
    expect(resolveProfile(undefined)).toBe("vt100");
    expect(resolveProfile("garbage")).toBe("vt100");
  });
});

describe("translateScreen (full-screen pages)", () => {
  const page = new Vt100Page()
    .clear()
    .bar(1, "OMNIDAT", "X.25")
    .at(5, 10, sgr("HELLO", 1))
    .toString();

  it("passes VT100 through unchanged", () => {
    expect(translateScreen(page, "vt100")).toBe(page);
  });

  it("re-emits the grid in ADM-3A dialect (Ctrl-Z clear + ESC= addressing, no ANSI)", () => {
    const out = translateScreen(page, "adm3a");
    expect(out.startsWith("\x1a")).toBe(true); // ADM-3A clear
    expect(out).toContain("\x1b="); // ESC= cursor addressing
    expect(out).toContain("HELLO");
    expect(out).toContain("OMNIDAT");
    // No ANSI CSI escapes survive for the non-ANSI terminal.
    expect(/\x1b\[/.test(out)).toBe(false);
  });

  it("linearizes to an upper-cased 72-col transcript for the ASR-33", () => {
    const out = translateScreen(page, "tty33");
    expect(/\x1b/.test(out)).toBe(false); // no escapes at all — it's a printer
    expect(out).toContain("HELLO");
    for (const row of out.split(/\r?\n/u)) expect(row.length).toBeLessThanOrEqual(72);
  });
});

describe("translateLine (scrolling output)", () => {
  it("keeps VT100 verbatim but strips ANSI for the ADM-3A", () => {
    const line = `${sgr("DIR", 1)} 311088010110`;
    expect(translateLine(line, "vt100")).toBe(line);
    const adm = translateLine(line, "adm3a");
    expect(adm).toBe("DIR 311088010110");
    expect(/\x1b/.test(adm)).toBe(false);
  });

  it("upper-cases and clips to 72 columns for the ASR-33", () => {
    const out = translateLine(`x`.repeat(90), "tty33");
    expect(out).toBe("X".repeat(72));
  });
});

describe("translateEcho", () => {
  it("upper-cases keystrokes only on the ASR-33", () => {
    expect(translateEcho("d", "vt100")).toBe("d");
    expect(translateEcho("d", "adm3a")).toBe("d");
    expect(translateEcho("d", "tty33")).toBe("D");
  });
});

describe("service screens through each personality", () => {
  const connect = connectServiceScreen("311088020501").page;

  it("renders Miliways on the ADM-3A without ANSI escapes", () => {
    const out = translateScreen(connect, "adm3a");
    expect(out).toContain("MILIWAYS ORDER ENTRY");
    expect(/\x1b\[/.test(out)).toBe(false);
  });

  it("renders Miliways on the ASR-33 as plain upper-case text", () => {
    const out = translateScreen(connect, "tty33");
    expect(out).toContain("MILIWAYS ORDER ENTRY");
    expect(out).toBe(out.toUpperCase());
  });

  it("declares distinct capabilities per profile", () => {
    expect(TERMINAL_PROFILES.vt100.attributes).toBe(true);
    expect(TERMINAL_PROFILES.adm3a.attributes).toBe(false);
    expect(TERMINAL_PROFILES.tty33.cursorAddressing).toBe(false);
    expect(TERMINAL_PROFILES.tty33.uppercaseOnly).toBe(true);
  });
});
