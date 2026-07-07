// The OMNIDAT telnet PAD bridge.
//
// A raw-TCP front door to the X.25 network for real terminals. Point a physical
// VT100 (via a serial-to-telnet adapter) or any telnet client at it and you land
// on the PAD prompt, drive verbs, open interactive service sessions, and — after
// a spell of inactivity — watch the attract screensaver, exactly as the web CRT
// does, because both render through @omnidat/operator-core.
//
// This layer owns everything stateful about a live connection: telnet option
// negotiation, the idle timer, and pacing the screensaver frames. The command
// surface itself lives in PadSession, which is pure and unit-tested.

import net from "node:net";

import { attractFrames } from "@omnidat/operator-core/attract";
import { VT } from "@omnidat/operator-core/vt100";

import { type Bridge, MatrixBridge } from "./bridge.js";
import { PadSession } from "./session.js";

// Telnet negotiation: server WILL ECHO + WILL SUPPRESS-GO-AHEAD nudges clients
// into character-at-a-time mode with server-side echo, which is what our line
// editor and cursor rendering assume.
const IAC = 0xff;
const WILL = 0xfb;
const DO = 0xfd;
const OPT_ECHO = 0x01;
const OPT_SGA = 0x03;
const NEGOTIATE = Buffer.from([
  IAC, WILL, OPT_ECHO,
  IAC, WILL, OPT_SGA,
  IAC, DO, OPT_SGA,
]);

export interface PadServerOptions {
  /** DTE address presented to connecting terminals. */
  dte?: string;
  /** Idle seconds before the screensaver starts (0 disables). */
  idleSeconds?: number;
  /** Max concurrent connections (soft cap; excess are greeted then closed). */
  maxConnections?: number;
  /** Default terminal personality (vt100 / adm3a / tty33); switch with TERM. */
  profile?: string;
  /** Matrix bridge for MSG/MAIL/board verbs; defaults to an env-driven client. */
  bridge?: Bridge;
  /** riot Discord-mirror gateway "host:port"; enables the RIOT relay verb. */
  riotGateway?: string;
}

interface Conn {
  session: PadSession;
  idleTimer?: ReturnType<typeof setTimeout>;
  attractTimer?: ReturnType<typeof setTimeout>;
  attractActive: boolean;
  relaySocket?: net.Socket;
  relaying: boolean;
  relayLine: string;
}

export function createPadServer(options: PadServerOptions = {}): net.Server {
  const dte = options.dte ?? "311088000001";
  const idleMs = (options.idleSeconds ?? 45) * 1000;
  const maxConnections = options.maxConnections ?? 64;
  const bridge = options.bridge ?? new MatrixBridge();
  // riot Discord-mirror gateway (its Packet Clearing daemon, default port 2625).
  const gateway = options.riotGateway ?? process.env.RIOT_GATEWAY ?? "";
  const [riotHost = "", riotPortRaw] = gateway.split(":");
  const riotPort = Number.parseInt(riotPortRaw ?? "2625", 10);
  const riotEnabled = Boolean(riotHost);

  const server = net.createServer((socket) => {
    socket.setNoDelay(true);
    const conn: Conn = {
      session: new PadSession(dte, options.profile, bridge, riotEnabled),
      attractActive: false,
      relaying: false,
      relayLine: "",
    };

    const write = (data: string) => {
      if (!socket.destroyed) socket.write(Buffer.from(data, "binary"));
    };

    const stopAttract = () => {
      if (conn.attractTimer) clearTimeout(conn.attractTimer);
      conn.attractTimer = undefined;
      if (conn.attractActive) {
        conn.attractActive = false;
        write(conn.session.attractEnded());
      }
    };

    const armIdle = () => {
      if (conn.idleTimer) clearTimeout(conn.idleTimer);
      // The screensaver is VT100-only; don't idle into it on other personalities.
      if (idleMs <= 0 || conn.session.terminalProfile !== "vt100") return;
      conn.idleTimer = setTimeout(startAttract, idleMs);
    };

    function startAttract() {
      if (conn.attractActive || socket.destroyed) return;
      if (conn.session.terminalProfile !== "vt100") return;
      conn.attractActive = true;
      const frames = attractFrames();
      let i = 0;
      write(VT.reset + VT.hideCursor);
      const tick = () => {
        if (!conn.attractActive || socket.destroyed) return;
        const frame = frames[i % frames.length];
        i += 1;
        if (!frame) return;
        write(frame.bytes);
        conn.attractTimer = setTimeout(tick, frame.ms);
      };
      tick();
    }

    // Greet, then start the idle countdown.
    write(NEGOTIATE.toString("binary"));
    write(conn.session.greeting());
    armIdle();

    // feed() is async (MSG/MAIL/board hit the bridge), so serialize inbound
    // chunks through a per-connection promise chain to keep command order.
    let pump: Promise<void> = Promise.resolve();
    socket.on("data", (data) => {
      if (conn.attractActive) {
        // Any keystroke wakes the terminal; discard it and return to the PAD.
        stopAttract();
        armIdle();
        return;
      }
      pump = pump.then(async () => {
        if (socket.destroyed) return;
        const result = await conn.session.feed(data);
        if (result.output) write(result.output);
        if (result.startAttract) {
          startAttract();
          return;
        }
        if (result.close) {
          socket.end();
          return;
        }
        armIdle();
      }).catch(() => {
        /* a command threw unexpectedly — keep the connection alive */
      });
    });

    const cleanup = () => {
      if (conn.idleTimer) clearTimeout(conn.idleTimer);
      if (conn.attractTimer) clearTimeout(conn.attractTimer);
    };
    socket.on("close", cleanup);
    socket.on("error", cleanup);

    // Best-effort connection cap.
    server.getConnections((err, count) => {
      if (!err && count > maxConnections) {
        write(`${VT.reset}OMNIDAT PAD BUSY — TRY AGAIN.\r\n`);
        socket.end();
      }
    });
  });

  return server;
}
