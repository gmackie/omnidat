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
// Store-and-forward messaging (MSG / MAIL) and message boards ride the Matrix
// bridge (bridge.ts / messaging.ts); those verbs are async and clear honestly
// when the bridge is offline.
//
// The session is a byte machine: feed it inbound bytes, get back outbound bytes
// and control signals. Sockets and timers live in the server layer; the bridge
// is injected — so the whole command surface is unit-testable against strings.

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

import { type BoardDef, type Bridge, BridgeCleared, type Catalog } from "./bridge.js";
import { isStatusBoard, normalizeStatusPost, statusHelp } from "./camp-status.js";
import type { RiotEntry } from "./riot.js";
import {
  resolveCatalog,
  runBoardPost,
  runBoardRead,
  runMail,
  runMsg,
  runSent,
} from "./messaging.js";

const CRLF = "\r\n";
const PAD_HELP =
  "VERBS: DIR [NS], LOOKUP <X121>, CALL <X121>, STATUS <X121>, PAD <X121>, BILL <ACCT>, MSG <TO> <TEXT>, MAIL, SENT <RCPT>, RIOT, ATTRACT, TERM <VT100|ADM3A|TTY33>, HELP, CLEAR";
const BOARD_HELP = "BOARD VERBS: READ [AFTER], POST <TEXT>, TERM <ID>, CLEAR";

export interface FeedResult {
  /** Bytes to write back to the terminal. */
  output: string;
  /** Close the connection after writing (CLEAR / BYE / QUIT). */
  close?: boolean;
  /** Start the attract screensaver (ATTRACT verb or idle) — server paces it. */
  startAttract?: boolean;
  /** Relay this session into the riot Discord-mirror gateway (server bridges TCP). */
  startRelay?: boolean;
  /** A command to send to riot immediately after the relay connects (direct CALL). */
  relayInitial?: string;
}

type Mode = "pad" | "session" | "board";

export class PadSession {
  private mode: Mode = "pad";
  private line = "";
  private sessionX121 = "";
  private board: BoardDef | null = null;
  private catalog?: Catalog;
  private profile: TerminalProfileId;
  // Telnet IAC parser state.
  private iac: "none" | "cmd" | "opt" | "sub" = "none";

  constructor(
    private readonly dte = "311088000001",
    profile: string = "vt100",
    private readonly bridge?: Bridge,
    private readonly riotEnabled = false,
    private readonly riotDirectory: () => RiotEntry[] = () => [],
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

  /** The current-mode prompt (PAD, service session, or board). */
  prompt(): string {
    if (this.mode === "board" && this.board) {
      return this.ln(`/${this.board.boardId}/ BOARD> `);
    }
    if (this.mode === "session") {
      return TERMINAL_PROFILES[this.profile].cursorAddressing
        ? this.pg(`${VT.to(24, 1)}\x1b[KCMD> `)
        : this.ln("CMD> ");
    }
    return this.ln(omnidatPrompt(this.dte));
  }

  /** Repaint after the screensaver stops. */
  resume(): string {
    return this.mode === "pad" ? this.ln(omnidatPrompt(this.dte)) : this.prompt();
  }

  /** Feed inbound bytes; returns bytes to send plus any control signal. */
  async feed(bytes: Buffer | string): Promise<FeedResult> {
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
        result = await this.run(cmd);
        out += result.output;
        if (result.close || result.startAttract || result.startRelay) break;
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

    return result?.close || result?.startAttract || result?.startRelay
      ? { ...result, output: out }
      : { output: out };
  }

  /** Called when the screensaver ends (any key or the server's own stop). */
  attractEnded(): string {
    return this.resume();
  }

  private async run(raw: string): Promise<FeedResult> {
    const cmd = raw.trim();
    const [verb = "", ...args] = cmd.split(/\s+/);
    // TERM switches personality from anywhere and repaints the current screen.
    if (verb.toUpperCase() === "TERM") {
      this.profile = resolveProfile(args[0]);
      if (this.mode === "session") {
        const screen = connectServiceScreen(this.sessionX121);
        return { output: `${this.pg(screen.page)}${this.prompt()}` };
      }
      return this.mode === "board"
        ? { output: `${this.ln("TERMINAL CHANGED.")}${CRLF}${this.prompt()}` }
        : { output: this.greeting() };
    }
    if (this.mode === "board") return this.runBoard(cmd);
    if (this.mode === "session") return this.runSession(cmd);
    return this.runPad(cmd);
  }

  /** A bridge call → its line body, or the honest CLR line on failure. */
  private async bridged(run: (bridge: Bridge) => Promise<string>): Promise<string> {
    if (!this.bridge) return "CLR DER C:9 D:0";
    try {
      return await run(this.bridge);
    } catch (error) {
      if (error instanceof BridgeCleared) return error.clrLine;
      return "CLR DER C:9 D:0";
    }
  }

  /** Lazily fetch and cache the board/mail catalog from the bridge. */
  private async ensureCatalog(): Promise<Catalog | undefined> {
    if (this.catalog) return this.catalog;
    if (!this.bridge) return undefined;
    try {
      this.catalog = await this.bridge.boards();
      return this.catalog;
    } catch {
      return undefined;
    }
  }

  private async runPad(cmd: string): Promise<FeedResult> {
    if (!cmd) return { output: this.ln(omnidatPrompt(this.dte)) };
    const [verbRaw = "", ...args] = cmd.split(/\s+/);
    const verb = verbRaw.toUpperCase();

    if (verb === "CLEAR" || verb === "BYE" || verb === "QUIT" || verb === "CLR") {
      return { output: this.ln(`CLEARED.${CRLF}CLR DTE C:0 D:0${CRLF}`), close: true };
    }
    if (verb === "ATTRACT") {
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
    // RIOT — relay into the riot Discord-mirror gateway (its own daemon). The
    // server bridges the TCP session; riot's verbs (DIRECTORY/CALL/CHANNELS/READ)
    // take over until QUIT.
    if (verb === "RIOT") {
      if (!this.riotEnabled) {
        return {
          output: this.ln(`RIOT GATEWAY NOT CONFIGURED${CRLF}${omnidatPrompt(this.dte)}`),
        };
      }
      return {
        output: this.ln(`CONNECTING TO RIOT DISCORD GATEWAY — QUIT TO RETURN${CRLF}`),
        startRelay: true,
      };
    }
    // MSG <to> <text...> — store-and-forward subscriber message via the bridge.
    if (verb === "MSG") {
      const to = args[0];
      const body = args.slice(1).join(" ");
      if (!to || !body) {
        return { output: this.ln(`USAGE: MSG <TO-X121> <TEXT>${CRLF}${omnidatPrompt(this.dte)}`) };
      }
      const line = await this.bridged((b) => runMsg(b, this.dte, to, body));
      return { output: this.ln(`${line}${CRLF}${omnidatPrompt(this.dte)}`) };
    }
    // MAIL — read (and mark) the subscriber mailbox for this DTE.
    if (verb === "MAIL") {
      const line = await this.bridged((b) => runMail(b, this.dte));
      return { output: this.ln(`${line}${CRLF}${omnidatPrompt(this.dte)}`) };
    }
    // SENT <rcpt> — telegram delivery status (030031).
    if (verb === "SENT") {
      const rcpt = args[0];
      if (!rcpt) {
        return { output: this.ln(`USAGE: SENT <RCPT>${CRLF}${omnidatPrompt(this.dte)}`) };
      }
      const line = await this.bridged((b) => runSent(b, rcpt));
      return { output: this.ln(`${line}${CRLF}${omnidatPrompt(this.dte)}`) };
    }
    if (verb === "CALL" && args[0]) {
      // A riot Discord-mirror address: relay straight into that guild.
      const riotEntry = this.riotDirectory().find((e) => e.address === args[0]);
      if (riotEntry) {
        return {
          output: this.ln(
            `CONNECTING TO ${riotEntry.name.toUpperCase()} (RIOT/DISCORD) — QUIT TO RETURN${CRLF}`,
          ),
          startRelay: true,
          relayInitial: `CALL ${args[0]}`,
        };
      }
      const catalog = await this.ensureCatalog();
      const svc = catalog ? resolveCatalog(catalog, args[0]) : undefined;
      if (svc?.kind === "board") {
        this.mode = "board";
        this.board = svc.board;
        const board = svc.board;
        const page = await this.bridged((b) => runBoardRead(b, board));
        const help = isStatusBoard(board.boardId)
          ? `${BOARD_HELP}${CRLF}${statusHelp()}`
          : BOARD_HELP;
        return { output: this.ln(`${page}${CRLF}${help}${CRLF}`) + this.prompt() };
      }
      if (svc?.kind === "mail") {
        const line = await this.bridged((b) => runMail(b, this.dte));
        return { output: this.ln(`${line}${CRLF}${omnidatPrompt(this.dte)}`) };
      }
      const screen = connectServiceScreen(args[0]);
      if (screen.ended) {
        return { output: `${this.pg(screen.page)}${this.ln(`${CRLF}${omnidatPrompt(this.dte)}`)}` };
      }
      this.mode = "session";
      this.sessionX121 = args[0];
      return { output: `${this.pg(screen.page)}${this.prompt()}` };
    }
    // DIR / LOOKUP / STATUS / PAD / BILL — the read verbs.
    const result = executeXotCommand({ sourceX121: this.dte, command: cmd });
    let transcript = result.transcript.replace(/\r?\n/gu, CRLF);
    // DIR folds in riot's Discord mirrors so they are discoverable and callable.
    if (verb === "DIR") {
      const riot = this.riotDirectory();
      if (riot.length > 0) {
        transcript += `${CRLF}${riot
          .map((e) => `${e.address}  ${e.name.toUpperCase()} (RIOT/DISCORD)`)
          .join(CRLF)}`;
      }
    }
    return {
      output: this.ln(`${transcript}${CRLF}${omnidatPrompt(this.dte)}`),
    };
  }

  private async runBoard(cmd: string): Promise<FeedResult> {
    const board = this.board;
    if (!board) {
      this.mode = "pad";
      return { output: this.ln(omnidatPrompt(this.dte)) };
    }
    const [verbRaw = "", ...args] = cmd.split(/\s+/);
    const verb = verbRaw.toUpperCase();

    if (verb === "CLEAR" || verb === "CLR" || verb === "BYE") {
      this.mode = "pad";
      this.board = null;
      return { output: this.ln(`CLR DTE C:0 D:0${CRLF}${omnidatPrompt(this.dte)}`) };
    }
    if (verb === "HELP" || verb === "?") {
      return { output: this.ln(`${BOARD_HELP}${CRLF}`) + this.prompt() };
    }
    if (verb === "READ") {
      const after = args[0] ? Number.parseInt(args[0], 10) : undefined;
      const page = await this.bridged((b) =>
        runBoardRead(b, board, Number.isNaN(after) ? undefined : after),
      );
      return { output: this.ln(`${page}${CRLF}`) + this.prompt() };
    }
    if (verb === "POST") {
      const body = args.join(" ");
      if (!body) return { output: this.ln(`USAGE: POST <TEXT>${CRLF}`) + this.prompt() };
      // On the camp status board, normalize the post against the status
      // vocabulary (a known code is upper-cased and split from its detail).
      const text = isStatusBoard(board.boardId)
        ? normalizeStatusPost(body).formatted
        : body;
      const line = await this.bridged((b) => runBoardPost(b, board, text));
      return { output: this.ln(`${line}${CRLF}`) + this.prompt() };
    }
    return { output: this.ln(`CLR NP C:13 D:0 — UNKNOWN BOARD VERB ${verb}${CRLF}`) + this.prompt() };
  }

  private async runSession(cmd: string): Promise<FeedResult> {
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
