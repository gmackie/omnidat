import { describe, expect, it, vi } from "vitest";

import { renderVt100Text } from "@omnidat/operator-core/vt100";

import type { Bridge } from "../bridge.js";
import { BridgeCleared } from "../bridge.js";
import { PadSession } from "../session.js";

/** Feed a full command line (adds CR) and return the output bytes. */
async function line(session: PadSession, cmd: string): Promise<string> {
  return (await session.feed(`${cmd}\r`)).output;
}

function mockBridge(overrides: Partial<Bridge> = {}): Bridge {
  return {
    sendDm: vi.fn(async () => ({ rcpt: "R1" })),
    mailbox: vi.fn(async () => [
      { no: 1, from: "000009", ts: "09:30", body: "HELLO SUBSCRIBER" },
    ]),
    markRead: vi.fn(async () => ({})),
    boardPage: vi.fn(async () => [
      { no: 1, poster: "anon", ts: 1_700_000_000_000, body: "FIRST POST" },
    ]),
    boardPost: vi.fn(async () => ({ no: 2, eventId: "e2" })),
    boards: vi.fn(async () => ({
      boards: [
        {
          address: "000401",
          boardId: "GEN",
          name: "OMNIDAT PUBLIC BOARD /GEN/",
          readClass: "PUBLIC",
          postClass: "PUBLIC",
        },
      ],
      mail: { address: "000007", name: "SUBSCRIBER MAIL" },
    })),
    receipt: vi.fn(async () => ({ rcpt: "R1", to: "000009", delivered: true, read: false })),
    ...overrides,
  };
}

describe("PadSession", () => {
  it("greets with a reset, banner, and prompt", () => {
    const s = new PadSession();
    const greeting = s.greeting();
    expect(greeting.startsWith("\x1bc")).toBe(true); // RIS
    expect(renderVt100Text(greeting)).toContain("OMNIDAT");
    expect(greeting).toContain("PAD>");
  });

  it("echoes printable characters as they are typed", async () => {
    const s = new PadSession();
    expect((await s.feed("DI")).output).toBe("DI");
  });

  it("handles backspace by erasing the last character", async () => {
    const s = new PadSession();
    await s.feed("DIRX");
    expect((await s.feed("\x7f")).output).toBe("\b \b"); // DEL erases the X
  });

  it("strips telnet IAC negotiation without leaking it into the line", async () => {
    const s = new PadSession();
    const out = (await s.feed(Buffer.from([0xff, 0xfb, 0x01, 0x44, 0x49, 0x52]))).output;
    expect(out).toBe("DIR");
  });

  it("runs DIR through the shared XOT command engine", async () => {
    const s = new PadSession();
    expect(renderVt100Text(await line(s, "DIR"))).toContain("311088");
  });

  it("enters an interactive session on CALL and renders the service screen", async () => {
    const s = new PadSession();
    const text = renderVt100Text(await line(s, "CALL 311088020501"));
    expect(text).toContain("MILIWAYS ORDER ENTRY");
    expect(renderVt100Text(await line(s, "MENU"))).toContain("NOODLE CUP");
  });

  it("returns to the PAD when the session clears", async () => {
    const s = new PadSession();
    await line(s, "CALL 311088020501");
    expect(renderVt100Text(await line(s, "CLEAR"))).toContain("SESSION CLEARED");
    expect(renderVt100Text(await line(s, "DIR"))).toContain("311088");
  });

  it("clears an unknown address with an honest cause but stays connected", async () => {
    const s = new PadSession();
    const out = await line(s, "CALL 311088099999");
    expect(renderVt100Text(out)).toContain("CLR NP C:13 D:67");
    expect((await line(s, "HELP")).length).toBeGreaterThan(0);
  });

  it("signals close on CLEAR at the PAD", async () => {
    const s = new PadSession();
    const result = await s.feed("CLEAR\r");
    expect(result.close).toBe(true);
    expect(renderVt100Text(result.output)).toContain("CLR DTE C:0 D:0");
  });

  it("signals attract on the ATTRACT verb", async () => {
    const s = new PadSession();
    const result = await s.feed("ATTRACT\r");
    expect(result.startAttract).toBe(true);
  });

  it("prints the verb list on HELP", async () => {
    const s = new PadSession();
    expect(await line(s, "HELP")).toContain("VERBS:");
  });

  it("switches terminal personality with TERM and re-greets", async () => {
    const s = new PadSession();
    expect(s.terminalProfile).toBe("vt100");
    const out = await line(s, "TERM ADM3A");
    expect(s.terminalProfile).toBe("adm3a");
    expect(/\x1b\[/.test(out)).toBe(false);
    expect(out).toContain("OMNIDAT");
  });

  it("upper-cases keystrokes on the ASR-33", async () => {
    const s = new PadSession("311088000001", "tty33");
    expect((await s.feed("dir")).output).toBe("DIR");
  });

  it("refuses the screensaver on the ASR-33", async () => {
    const s = new PadSession("311088000001", "tty33");
    const attract = await s.feed("ATTRACT\r");
    expect(attract.startAttract).toBeUndefined();
    expect(attract.output).toContain("REQUIRES VT100");
  });

  it("starts in the personality passed to the constructor", () => {
    const s = new PadSession("311088000001", "adm3a");
    expect(s.terminalProfile).toBe("adm3a");
    expect(/\x1b\[/.test(s.greeting())).toBe(false);
  });
});

describe("PadSession bridge-backed messaging", () => {
  it("sends a subscriber message with MSG and shows the receipt", async () => {
    const bridge = mockBridge();
    const s = new PadSession("311088000001", "vt100", bridge);
    const out = await line(s, "MSG 000009 hi there");
    expect(bridge.sendDm).toHaveBeenCalledWith("311088000001", "000009", "hi there");
    expect(out).toContain("MSG SENT RCPT R1 CLR 00");
  });

  it("prompts for usage when MSG is incomplete", async () => {
    const s = new PadSession("311088000001", "vt100", mockBridge());
    expect(await line(s, "MSG")).toContain("USAGE: MSG");
  });

  it("reads and marks the mailbox with MAIL", async () => {
    const bridge = mockBridge();
    const s = new PadSession("311088000001", "vt100", bridge);
    const out = await line(s, "MAIL");
    expect(out).toContain("OMNIDAT SUBSCRIBER MAIL  311088000001");
    expect(out).toContain("HELLO SUBSCRIBER");
    expect(out).toContain("END OF MAIL   1 MSG");
    expect(bridge.markRead).toHaveBeenCalledWith("311088000001");
  });

  it("enters a board on CALL, reads posts, and posts with a de-anonymized ctx", async () => {
    const bridge = mockBridge();
    const s = new PadSession("311088000001", "vt100", bridge);
    const opened = await line(s, "CALL 000401");
    expect(opened).toContain("OMNIDAT PUBLIC BOARD /GEN/");
    expect(opened).toContain("FIRST POST");
    // Board prompt is active.
    const posted = await line(s, "POST second post");
    expect(posted).toContain("RCPT No.00002 CLR 00");
    // The PUBLIC-post de-anonymization guard: ctx carries only the transport.
    expect(bridge.boardPost).toHaveBeenCalledWith("GEN", "second post", {
      ctx: { transport: "pad" },
    });
  });

  it("reports telegram delivery status with SENT", async () => {
    const bridge = mockBridge({
      receipt: vi.fn(async () => ({ rcpt: "MSG-00001", to: "000009", delivered: true, read: true, readAt: "09:31" })),
    });
    const s = new PadSession("311088000001", "vt100", bridge);
    const out = await line(s, "SENT MSG-00001");
    expect(bridge.receipt).toHaveBeenCalledWith("MSG-00001");
    expect(out).toContain("TELEGRAM MSG-00001");
    expect(out).toContain("READ 09:31");
  });

  it("resolves boards from the bridge catalog, not a hardcoded list", async () => {
    const bridge = mockBridge();
    const s = new PadSession("311088000001", "vt100", bridge);
    await line(s, "CALL 000401");
    expect(bridge.boards).toHaveBeenCalled();
  });

  it("clears an offline bridge with an honest CLR (no crash)", async () => {
    const bridge = mockBridge({
      mailbox: vi.fn(async () => {
        throw new BridgeCleared("DER", 9, 0, "connect ECONNREFUSED");
      }),
    });
    const s = new PadSession("311088000001", "vt100", bridge);
    expect(await line(s, "MAIL")).toContain("CLR DER C:9 D:0");
  });

  it("clears MSG when no bridge is configured", async () => {
    const s = new PadSession(); // no bridge
    expect(await line(s, "MSG 000009 hi")).toContain("CLR DER C:9 D:0");
  });
});
