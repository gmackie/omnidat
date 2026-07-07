// A single telnet PAD session — the testable core of the bridge.
//
// This is where a raw terminal (a physical VT100/ADM-3A on a serial-to-telnet
// adapter, an ASR-33 teletype, or `telnet console.omnidat.cc 2525`) meets the
// OMNIDAT network. It reuses the exact same renderers as the web CRT
// (@omnidat/operator-core) so there is one source of truth for the banner, the
// PAD verbs, and the interactive service screens — no drift between the browser
// and the wire.
//
// Screens are authored as VT100 and translated to the connected terminal's
// personality (VT100 / ADM-3A / ASR-33) on the way out, so the same session
// drives very different hardware. Switch with `TERM <id>`.
//
// The session is a pure byte machine: feed it inbound bytes, get back outbound
// bytes and control signals. No sockets, no timers — the server layer owns those
// — so the whole command surface is unit-testable against strings.

import { executeXotCommand } from "@omnidat/operator-core/omnidat";
import {
  type TerminalProfileId,
  TERMINAL_PROFILES,
  resolveProfile,
  translateEcho,
  translateLine,
  translateScreen,
} from "@omnidat/operator-core/profiles";
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
  "VERBS: DIR [NS], LOOKUP <X121>, CALL <X121>, STATUS <X121>, PAD <X121>, BILL <ACCT>, ATTRACT, TERM <VT100|ADM3A|TTY33>, HELP, CLEAR";

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
  private profile: TerminalProfileId;
  // Telnet IAC parser state.
  private iac: "none" | "cmd" | "opt" | "sub" = "none";

  constructor(
    private readonly dte = "311088000001",
    profile: string = "vt100",
  ) {
    this.profile = resolveProfile(profile);
  }

  /** The connected terminal personality. */
  get terminalProfile(): TerminalProfileId {
    return this.profile;
  }

  // Line-oriented scrolling output (banner, transcripts, prompts).
  private ln(vt100: string): string {
    return translateLine(vt100, this.profile);
  }
  // A full-screen, cursor-addressed page (service screens).
  private pg(vt100: string): string {
    return translateScreen(vt100, this.profile);
  }

  private rawBanner(): string {
    return (
      VT.reset +
      buildOmnidatLoginBanner({ x121: this.dte, operator: "GUEST" }).replace(
        /\r?\n/gu,
        CRLF,
      ) +
      `${CRLF}TERMINAL ${TERMINAL_PROFILES[this.profile].name.toUpperCase()} — TERM TO CHANGE${CRLF}` +
      CRLF +
      omnidatPrompt(this.dte)
    );
  }

  /** The connect screen: reset, login banner, first prompt. */
  greeting(): string {
    return this.ln(this.rawBanner());
  }

  /** The PAD prompt (used when returning from a session or the screensaver). */
  prompt(): string {
    if (this.mode === "session") {
      // On a printing terminal there is no fixed command line — just prompt.
      return TERMINAL_PROFILES[this.profile].cursorAddressing
        ? this.pg(`${VT.to(24, 1)}\x1b[KCMD> `)
        : this.ln("CMD> ");
    }
    return this.ln(omnidatPrompt(this.dte));
  }

  /** Repaint after the screensaver stops. */
  resume(): string {
    return this.mode === "session" ? this.prompt() : this.ln(omnidatPrompt(this.dte));
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
      out += translateEcho(ch, this.profile);
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
    const [verb = "", ...args] = cmd.split(/\s+/);
    // TERM switches personality from anywhere (PAD or an open service session)
    // and repaints the current screen in the new dialect.
    if (verb.toUpperCase() === "TERM") {
      this.profile = resolveProfile(args[0]);
      if (this.mode === "session") {
        const screen = connectServiceScreen(this.sessionX121);
        return { output: `${this.pg(screen.page)}${this.prompt()}` };
      }
      return { output: this.greeting() };
    }
    if (this.mode === "session") return this.runSession(cmd);
    return this.runPad(cmd);
  }

  private runPad(cmd: string): FeedResult {
    if (!cmd) return { output: this.ln(omnidatPrompt(this.dte)) };
    const [verbRaw = "", ...args] = cmd.split(/\s+/);
    const verb = verbRaw.toUpperCase();

    if (verb === "CLEAR" || verb === "BYE" || verb === "QUIT" || verb === "CLR") {
      return { output: this.ln(`CLEARED.${CRLF}CLR DTE C:0 D:0${CRLF}`), close: true };
    }
    if (verb === "ATTRACT") {
      // The screensaver is a VT100 showpiece (cursor-addressed animation); it
      // would be noise on the ADM-3A / ASR-33, so only the VT100 gets it.
      if (this.profile !== "vt100") {
        return {
          output: this.ln(
            `SCREENSAVER REQUIRES VT100 (TERM VT100).${CRLF}${omnidatPrompt(this.dte)}`,
          ),
        };
      }
      return { output: "", startAttract: true };
    }
    if (verb === "HELP" || verb === "?") {
      return { output: this.ln(`${PAD_HELP}${CRLF}${omnidatPrompt(this.dte)}`) };
    }
    if (verb === "CALL" && args[0]) {
      const screen = connectServiceScreen(args[0]);
      if (screen.ended) {
        // Unknown address — show the clear screen, stay at the PAD.
        return { output: `${this.pg(screen.page)}${this.ln(`${CRLF}${omnidatPrompt(this.dte)}`)}` };
      }
      this.mode = "session";
      this.sessionX121 = args[0];
      return { output: `${this.pg(screen.page)}${this.prompt()}` };
    }
    // DIR / LOOKUP / STATUS / PAD / BILL — the read verbs.
    const result = executeXotCommand({ sourceX121: this.dte, command: cmd });
    return {
      output: this.ln(
        `${result.transcript.replace(/\r?\n/gu, CRLF)}${CRLF}${omnidatPrompt(this.dte)}`,
      ),
    };
  }

  private runSession(cmd: string): FeedResult {
    const [verb = "", ...args] = cmd.split(/\s+/);
    const screen = renderServiceVerb({ x121: this.sessionX121, verb, args });
    if (screen.ended) {
      this.mode = "pad";
      this.sessionX121 = "";
      return { output: `${this.pg(screen.page)}${this.ln(`${CRLF}${omnidatPrompt(this.dte)}`)}` };
    }
    return { output: `${this.pg(screen.page)}${this.prompt()}` };
  }
}
