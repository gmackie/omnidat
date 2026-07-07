// OMNIDAT attract mode — a self-playing VT100 screensaver.
//
// A deterministic, loopable sequence of paced frames that any VT100-class
// terminal can render: boot self-test, title card, an animated packet-switched
// network map, a directory sweep, a live call trace, and a ShadyBucks ticker.
// No clock, no randomness — the same frames every run, so it is byte-stable for
// caching and recording. Scene chrome is drawn once per scene and only the
// moving region is repainted per frame, so it idles on a real CRT without the
// full-screen flicker of a clear-every-frame loop.
//
// Delivery: `attractStreamOnce()` yields one full cycle as a byte string (pipe
// to a serial port or `curl -sN`); `attractFrames()` yields paced frames for a
// server-streamed or web-CRT player that loops forever.

import { getOperationalState } from "./omnidat";
import { VT, Vt100Page, sgr } from "./vt100";

export interface AttractFrame {
  /** Milliseconds to hold this frame before the next. */
  ms: number;
  /** Raw VT100 bytes (a full page on a scene's first frame, a delta after). */
  bytes: string;
}

const SPINNER = ["|", "/", "-", "\\"];

// LARP corporate slogan for immersion
const LORE_SLOGAN = "YOUR BUSINESS IS ALREADY IN OUR SYSTEM";
const LORE_LINES = [
  "THE RECORD IS TOTAL",
  "COMPLIANCE IS THE ONLY STATE",
  "DEVIATION IS CORRECTED",
  "ASSIMILATION IS CONTINUOUS",
  "RESISTANCE IS LATENCY",
  "THE LEDGER OBSERVES",
  "YOU ARE ALREADY ACCOUNTED FOR",
  "THE CHANNEL COMPELS"
];

// Deterministic per-character typing rhythm (no clock, no RNG): a base delay
// plus a small per-glyph jitter derived from the character code, with a longer
// beat after spaces. Reads like someone typing on a slow async line.
function typeMs(ch: string): number {
  const base = 78 + (ch.charCodeAt(0) % 6) * 18;
  return ch === " " ? base + 55 : base;
}

// Emit a line typed one glyph at a time starting at 1-based (row,col). The first
// frame positions the cursor; each later frame appends a single character, so
// the cursor carries forward and the text arrives keystroke by keystroke.
function typeInto(
  frames: AttractFrame[],
  row: number,
  col: number,
  text: string,
): void {
  [...text].forEach((ch, i) => {
    frames.push({
      ms: typeMs(ch),
      bytes: (i === 0 ? VT.to(row, col) : "") + ch,
    });
  });
}

// A simulated X.25 network-latency pause: an animated ellipsis holds for a few
// beats (the circuit establishing / the far end thinking), then is erased.
function netWait(
  frames: AttractFrame[],
  row: number,
  col: number,
  label: string,
  cycles = 5,
  holdMs = 340,
): void {
  for (let i = 0; i < cycles; i += 1) {
    const dots = ".".repeat((i % 3) + 1).padEnd(3, " ");
    frames.push({
      ms: holdMs,
      bytes: new Vt100Page().at(row, col, `${label}${dots}`, 2).toString(),
    });
  }
  frames.push({
    ms: 90,
    bytes: new Vt100Page().at(row, col, " ".repeat(label.length + 3)).toString(),
  });
}

function titleChrome(): Vt100Page {
  return new Vt100Page()
    .clear()
    .hideCursor()
    .bar(1, "OMNIDAT PACKET SWITCHED NETWORK", "X.25")
    .center(6, "O M N I D A T", 1)
    .center(8, "EXCHANGE 88 · TOORCAMP")
    .center(24, "AN X.25 CARRIER FOR THE HACKER CAMPS", 2);
}

function bootScene(frames: AttractFrame[]): void {
  const checks = [
    "PACKET ASSEMBLER/DISASSEMBLER ... OK",
    "X.121 ADDRESS PLAN ............. OK",
    "VIRTUAL CIRCUIT TABLE .......... OK",
    "SHADYBUCKS CLEARING ............ OK",
    "CARRIER READY.",
  ];
  const base = new Vt100Page().clear().hideCursor().bar(1, "OMNIDAT SELF TEST", "COLD START");
  frames.push({ ms: 500, bytes: base.toString() });
  checks.forEach((line, i) => {
    frames.push({
      ms: i === checks.length - 1 ? 700 : 320,
      bytes: new Vt100Page().at(4 + i, 5, line, i === checks.length - 1 ? 1 : 0).toString(),
    });
  });
}

function titleScene(frames: AttractFrame[]): void {
  frames.push({ ms: 400, bytes: titleChrome().toString() });
  frames.push({
    ms: 800,
    bytes: new Vt100Page()
      .at(14, 10, sgr(LORE_SLOGAN, 1))
      .toString(),
  });
  for (let i = 0; i < LORE_LINES.length; i += 1) {
    frames.push({
      ms: 600,
      bytes: new Vt100Page()
        .at(16 + i, 15, sgr(LORE_LINES[i] ?? "", 0))
        .toString(),
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const on = i % 2 === 0;
    frames.push({
      ms: 420,
      bytes: new Vt100Page()
        .at(11, 30, on ? sgr("> CONNECTED <", 7) : "             ")
        .at(20, 36, SPINNER[i % 4] ?? "|", 1)
        .toString(),
    });
  }
}

// A small packet-switched topology: nodes on a ring, a packet hops the path.
const NODES: { label: string; row: number; col: number }[] = [
  { label: "EX88", row: 7, col: 10 },
  { label: "NOC", row: 5, col: 40 },
  { label: "PAD3", row: 10, col: 66 },
  { label: "MILW", row: 16, col: 52 },
  { label: "BANK", row: 18, col: 20 },
];

function networkScene(frames: AttractFrame[]): void {
  const chrome = new Vt100Page()
    .clear()
    .hideCursor()
    .bar(1, "OMNIDAT · LIVE NETWORK", "X.25 VC MAP");
  // Draw nodes as labelled boxes.
  for (const n of NODES) {
    chrome.box(n.row, n.col, n.label.length + 4, 3, undefined).at(n.row + 1, n.col + 2, n.label, 1);
  }
  chrome.at(23, 3, "VIRTUAL CIRCUITS ESTABLISHING…", 2);
  frames.push({ ms: 500, bytes: chrome.toString() });

  // A packet marker travels EX88 -> NOC -> PAD3 -> MILW -> BANK -> EX88.
  const path = [...NODES, NODES[0]!];
  for (let seg = 0; seg < path.length - 1; seg += 1) {
    const a = path[seg]!;
    const b = path[seg + 1]!;
    const steps = 6;
    for (let s = 0; s <= steps; s += 1) {
      const row = Math.round(a.row + 1 + ((b.row + 1 - (a.row + 1)) * s) / steps);
      const col = Math.round(a.col + 2 + ((b.col + 2 - (a.col + 2)) * s) / steps);
      const page = new Vt100Page()
        // clear the previous marker lane cheaply by repainting the status line
        .at(23, 3, `VC ${a.label}→${b.label}  SEG ${seg + 1}/${path.length - 1}   `, 2)
        .at(row, col, sgr("█", 1));
      frames.push({ ms: 90, bytes: page.toString() });
      // erase marker so it doesn't leave a trail (repaint a space next frame)
      frames.push({ ms: 20, bytes: new Vt100Page().at(row, col, " ").toString() });
    }
  }
}

function directoryScene(frames: AttractFrame[]): void {
  const services = getOperationalState().services.slice(0, 8);
  const chrome = new Vt100Page()
    .clear()
    .hideCursor()
    .bar(1, "OMNIDAT · SERVICE DIRECTORY", "DIR")
    .at(3, 5, "X.121          SERVICE                       ST", 4);
  services.forEach((s, i) => {
    chrome.at(
      5 + i,
      5,
      `${s.x121}  ${s.name.toUpperCase().padEnd(28, " ").slice(0, 28)}  ${s.status === "up" ? "UP" : "DN"}`,
    );
  });
  frames.push({ ms: 500, bytes: chrome.toString() });
  // A reverse-video highlight sweeps down the list.
  for (let i = 0; i < services.length; i += 1) {
    const s = services[i]!;
    const line = `${s.x121}  ${s.name.toUpperCase().padEnd(28, " ").slice(0, 28)}  ${s.status === "up" ? "UP" : "DN"}`;
    const prev = i > 0 ? services[i - 1]! : null;
    const page = new Vt100Page().at(5 + i, 5, sgr(line, 7));
    if (prev) {
      const pline = `${prev.x121}  ${prev.name.toUpperCase().padEnd(28, " ").slice(0, 28)}  ${prev.status === "up" ? "UP" : "DN"}`;
      page.at(4 + i, 5, pline); // restore the one above to normal video
    }
    frames.push({ ms: 240, bytes: page.toString() });
  }
}

function callScene(frames: AttractFrame[]): void {
  // The PAD prompt, then a call typed out on the wire — deliberately unhurried,
  // with real X.25 circuit-setup and processing pauses between send and reply.
  frames.push({
    ms: 600,
    bytes: new Vt100Page()
      .clear()
      .hideCursor()
      .bar(1, "OMNIDAT · PAD SESSION", "X.28")
      .at(3, 3, "311088000001 PAD> ", 1)
      .toString(),
  });
  // Operator types the CALL (prompt is 18 cols wide from col 3 → text at col 21).
  typeInto(frames, 3, 21, "CALL 311088020501");
  // Enter → the virtual circuit takes a beat to come up.
  netWait(frames, 5, 3, "CALLING 311088020501 ", 5, 360);
  // The far end answers, one packet (line) at a time.
  const response: [string, boolean][] = [
    ["CONNECT MILIWAYS ORDER ENTRY", true],
    ["OWNER  DEPARTMENT OF RECREATIONAL COMMERCE", false],
    ["STATUS UP", false],
  ];
  response.forEach(([line, bold], i) => {
    frames.push({
      ms: 320,
      bytes: new Vt100Page().at(5 + i, 3, line, bold ? 1 : 0).toString(),
    });
  });
  // A verb typed inside the session, then order-entry processing latency.
  typeInto(frames, 9, 3, "> ORDER.CREATE NOODLE-CUP");
  netWait(frames, 11, 3, "PROCESSING ", 4, 320);
  frames.push({
    ms: 620,
    bytes: new Vt100Page().at(11, 3, "ORDER MW-4F2A9C CONFIRMED  7 SB", 1).toString(),
  });
  frames.push({
    ms: 1000,
    bytes: new Vt100Page().at(13, 3, "CLR DTE C:0 D:0").toString(),
  });
}

function tickerScene(frames: AttractFrame[]): void {
  const chrome = new Vt100Page()
    .clear()
    .hideCursor()
    .bar(1, "OMNIDAT · SHADYBUCKS CLEARING", "ISO 8583")
    .box(4, 8, 56, 12, "SETTLEMENT TICKER");
  frames.push({ ms: 400, bytes: chrome.toString() });
  const merchants = ["MILIWAYS", "NIGHT MARKET", "PACKET BAR", "ATV STATION", "PASSPORT DESK"];
  let total = 0;
  for (let i = 0; i < merchants.length; i += 1) {
    const amt = 4 + ((i * 7 + 3) % 17); // deterministic pseudo-amount
    total += amt;
    frames.push({
      ms: 380,
      bytes: new Vt100Page()
        .at(6 + i, 11, `${merchants[i]!.padEnd(22, " ")} ${String(amt).padStart(4, " ")} SB  APPROVED`, 0)
        .at(18, 11, `CLEARED TOTAL ${String(total).padStart(5, " ")} SB`, 1)
        .toString(),
    });
  }
  frames.push({ ms: 900, bytes: new Vt100Page().at(20, 11, sgr(" SETTLEMENT COMPLETE ", 7)).toString() });
}

/** One full attract cycle as paced frames (loop it for a screensaver). */
export function attractFrames(): AttractFrame[] {
  const frames: AttractFrame[] = [];
  bootScene(frames);
  titleScene(frames);
  networkScene(frames);
  directoryScene(frames);
  callScene(frames);
  tickerScene(frames);
  return frames;
}

/**
 * One full cycle flattened to a byte string. Suitable for piping straight to a
 * serial terminal (`curl -sN … > /dev/ttyS0`) where the transport does not pace
 * frames; motion still reads because scenes clear and redraw. Ends by homing the
 * cursor so a re-invocation in a loop starts clean.
 */
export function attractStreamOnce(): string {
  return (
    VT.reset +
    attractFrames()
      .map((f) => f.bytes)
      .join("") +
    VT.home
  );
}
