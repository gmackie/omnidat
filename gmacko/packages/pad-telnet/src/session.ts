// A single telnet PAD session — the testable core of the bridge.
//
// This is where a raw terminal (a physical VT100 on a serial-to-telnet adapter,
// or `telnet console.omnidat.cc 2525`) meets the OMNIDAT network. It reuses the
// exact same renderers as the web CRT (@omnidat/operator-core) so there is one
// source of truth for the banner, the PAD verbs, and the interactive service
// screens — no drift between the browser and the wire.
//
// The session is a pure byte machine: feed it inbound bytes, get back outbound
// bytes and control signals. No sockets, no timers — the server layer owns those
// — so the whole command surface is unit-testable against strings.

import { executeXotCommand } from "@omnidat/operator-core/omnidat";
import {
  connectServiceScreen,
  renderServiceVerb,
} from "@omnidat/operator-core/terminal";
import {
  VT,
  buildOmnidatLoginBanner,
  omnidatPrompt,
} from "@omnidat/operator-core/vt100";

const CRLF = "\r\n";
const PAD_HELP =
  "VERBS: DIR [NS], LOOKUP <X121>, CALL <X121>, STATUS <X121>, PAD <X121>, BILL <ACCT>, ATTRACT, HELP, CLEAR";

export interface FeedResult {
  /** Bytes to write back to the terminal. */
  output: string;
  /** Close the connection after writing (CLEAR / BYE / QUIT). */
  close?: boolean;
  /** Start the attract screensaver (ATTRACT verb or idle) — server paces it. */
  startAttract?: boolean;
}

type Mode = "pad" | "session";

export class PadSession {
  private mode: Mode = "pad";
  private line = "";
  private sessionX121 = "";
  // Telnet IAC parser state.
  private iac: "none" | "cmd" | "opt" | "sub" = "none";

  constructor(private readonly dte = "311088000001") {}

  /** The connect screen: reset, login banner, first prompt. */
  greeting(): string {
    return (
      VT.reset +
      buildOmnidatLoginBanner({ x121: this.dte, operator: "GUEST" }).replace(
        /\r?\n/gu,
        CRLF,
      ) +
      CRLF +
      omnidatPrompt(this.dte)
    );
  }

  /** The PAD prompt (used when returning from a session or the screensaver). */
  prompt(): string {
    return this.mode === "session"
      ? `${VT.to(24, 1)}\x1b[KCMD> `
      : omnidatPrompt(this.dte);
  }

  /** Repaint after the screensaver stops. */
  resume(): string {
    if (this.mode === "session") return `${VT.reset}${this.prompt()}`;
    return `${VT.reset}${omnidatPrompt(this.dte)}`;
  }

  /** Feed inbound bytes; returns bytes to send plus any control signal. */
  feed(bytes: Buffer | string): FeedResult {
    const buf = typeof bytes === "string" ? Buffer.from(bytes, "binary") : bytes;
    let out = "";
    let result: FeedResult | null = null;

    for (const byte of buf) {
      // Strip telnet IAC negotiation so it never reaches the line buffer.
      if (this.iac !== "none") {
        if (this.iac === "cmd") {
          if (byte === 0xfa) this.iac = "sub"; // SB — read until SE
          else if (byte >= 0xfb && byte <= 0xfe) this.iac = "opt"; // WILL/WONT/DO/DONT
          else this.iac = "none"; // standalone command
        } else if (this.iac === "opt") {
          this.iac = "none"; // consume the option byte
        } else if (this.iac === "sub") {
          if (byte === 0xf0) this.iac = "none"; // SE ends subnegotiation
        }
        continue;
      }
      if (byte === 0xff) {
        this.iac = "cmd";
        continue;
      }

      // Line editing.
      if (byte === 0x0d) {
        // CR — end of line. Run the command.
        out += CRLF;
        const cmd = this.line;
        this.line = "";
        result = this.run(cmd);
        out += result.output;
        if (result.close || result.startAttract) break;
        continue;
      }
      if (byte === 0x0a || byte === 0x00) continue; // ignore LF/NUL after CR
      if (byte === 0x08 || byte === 0x7f) {
        // Backspace / DEL.
        if (this.line.length > 0) {
          this.line = this.line.slice(0, -1);
          out += "\b \b";
        }
        continue;
      }
      if (byte === 0x03) {
        // Ctrl-C — abandon the line.
        this.line = "";
        out += `${CRLF}${this.prompt()}`;
        continue;
      }
      if (byte < 0x20 || byte > 0x7e) continue; // ignore other control/non-ASCII
      // Printable: echo it (server echo, we negotiated WILL ECHO) and buffer it.
      const ch = String.fromCharCode(byte);
      this.line += ch;
      out += ch;
    }

    return result?.close || result?.startAttract
      ? { ...result, output: out }
      : { output: out };
  }

  /** Called when the screensaver ends (any key or the server's own stop). */
  attractEnded(): string {
    return this.resume();
  }

  private run(raw: string): FeedResult {
    const cmd = raw.trim();
    if (this.mode === "session") return this.runSession(cmd);
    return this.runPad(cmd);
  }

  private runPad(cmd: string): FeedResult {
    if (!cmd) return { output: omnidatPrompt(this.dte) };
    const [verbRaw = "", ...args] = cmd.split(/\s+/);
    const verb = verbRaw.toUpperCase();

    if (verb === "CLEAR" || verb === "BYE" || verb === "QUIT" || verb === "CLR") {
      return { output: `CLEARED.${CRLF}CLR DTE C:0 D:0${CRLF}`, close: true };
    }
    if (verb === "ATTRACT") {
      return { output: "", startAttract: true };
    }
    if (verb === "HELP" || verb === "?") {
      return { output: `${PAD_HELP}${CRLF}${omnidatPrompt(this.dte)}` };
    }
    if (verb === "CALL" && args[0]) {
      const screen = connectServiceScreen(args[0]);
      if (screen.ended) {
        // Unknown address — show the clear screen, stay at the PAD.
        return { output: `${screen.page}${CRLF}${omnidatPrompt(this.dte)}` };
      }
      this.mode = "session";
      this.sessionX121 = args[0];
      return { output: `${screen.page}${this.prompt()}` };
    }
    // DIR / LOOKUP / STATUS / PAD / BILL — the read verbs.
    const result = executeXotCommand({ sourceX121: this.dte, command: cmd });
    return {
      output: `${result.transcript.replace(/\r?\n/gu, CRLF)}${CRLF}${omnidatPrompt(this.dte)}`,
    };
  }

  private runSession(cmd: string): FeedResult {
    const [verb = "", ...args] = cmd.split(/\s+/);
    const screen = renderServiceVerb({ x121: this.sessionX121, verb, args });
    if (screen.ended) {
      this.mode = "pad";
      this.sessionX121 = "";
      return { output: `${screen.page}${CRLF}${omnidatPrompt(this.dte)}` };
    }
    return { output: `${screen.page}${this.prompt()}` };
  }
}
