// Bridge-backed PAD messaging: subscriber MAIL/MSG and public message boards.
//
// These verbs ride the OMNIDAT Matrix bridge (see bridge.ts). The catalog and
// the on-screen formats mirror the Python packet tool (tools/omnidat_packet.py,
// tools/omnidat_bridge.py) so both PADs present the same thing. Output is plain
// line-oriented text; the caller runs it through the terminal personality so it
// renders correctly on VT100 / ADM-3A / ASR-33 alike.

import type { Bridge, BoardItem, MailItem } from "./bridge.js";
import { BridgeCleared } from "./bridge.js";

export interface BoardService {
  kind: "board";
  address: string;
  name: string;
  boardId: string;
  readClass: string;
  postClass: string;
}
export interface MailService {
  kind: "mail";
  address: string;
  name: string;
}

// The stable bridge-backed addresses (data/packet-services.json). Kept small and
// explicit; add boards here as they are seeded.
export const SUBSCRIBER_MAIL: MailService = {
  kind: "mail",
  address: "000007",
  name: "SUBSCRIBER MAIL",
};
export const BRIDGE_BOARDS: Record<string, BoardService> = {
  "000401": {
    kind: "board",
    address: "000401",
    name: "OMNIDAT PUBLIC BOARD /GEN/",
    boardId: "GEN",
    readClass: "PUBLIC",
    postClass: "PUBLIC",
  },
};

export function bridgeServiceAt(address: string): BoardService | MailService | undefined {
  if (address === SUBSCRIBER_MAIL.address) return SUBSCRIBER_MAIL;
  return BRIDGE_BOARDS[address];
}

const CRLF = "\r\n";

/** Bridge timestamps: mailbox is already HH:MM, board pages are epoch ms. */
function terseTime(ts: unknown): string {
  if (typeof ts === "number") return msToHhmm(ts);
  const text = String(ts ?? "");
  if (/^\d+$/u.test(text)) return msToHhmm(Number(text));
  if (text.includes("T")) return text.slice(11, 16);
  return text;
}
function msToHhmm(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function formatSendReceipt(rcpt: unknown): string {
  return `MSG SENT RCPT ${rcpt} CLR 00`;
}

export function formatMailbox(addr: string, items: MailItem[]): string {
  const lines = [`OMNIDAT SUBSCRIBER MAIL  ${addr}`];
  if (items.length === 0) {
    lines.push("NO MAIL");
  } else {
    for (const item of items) {
      lines.push(
        `${pad(Number(item.no), 3)} FROM ${item.from}  ${terseTime(item.ts)}  ${item.body}`,
      );
    }
    lines.push(`END OF MAIL ${String(items.length).padStart(3, " ")} MSG`);
  }
  lines.push("CLR 00");
  return lines.join(CRLF);
}

export function formatBoardPage(
  boardId: string,
  items: BoardItem[],
  readClass = "PUBLIC",
): string {
  const lines = [`OMNIDAT ${readClass} BOARD /${boardId}/`];
  if (items.length === 0) {
    lines.push("NO POSTS");
  } else {
    for (const item of items) {
      const poster = String(item.poster ?? "");
      const posterCol = poster.length <= 20 ? poster.padEnd(20, " ") : `${poster} `;
      lines.push(`No.${pad(Number(item.no), 5)} ${posterCol} ${terseTime(item.ts)}  ${item.body}`);
    }
  }
  lines.push("CLR 00");
  return lines.join(CRLF);
}

export function formatPostReceipt(no: unknown): string {
  return `RCPT No.${pad(Number(no), 5)} CLR 00`;
}

// ---- Async command handlers -------------------------------------------
// Each returns the plain line-oriented body (no trailing prompt), or throws a
// BridgeCleared the caller renders as its CLR line.

export async function runMsg(
  bridge: Bridge,
  from: string,
  to: string,
  body: string,
): Promise<string> {
  const receipt = await bridge.sendDm(from, to, body);
  return formatSendReceipt(receipt.rcpt ?? receipt.no ?? "?");
}

export async function runMail(bridge: Bridge, addr: string): Promise<string> {
  const items = await bridge.mailbox(addr);
  if (items.length > 0) await bridge.markRead(addr);
  return formatMailbox(addr, items);
}

export async function runBoardRead(
  bridge: Bridge,
  board: BoardService,
  after?: number,
): Promise<string> {
  if (board.readClass !== "PUBLIC") {
    // The anonymous PAD has no passport to satisfy a registered-read gate.
    throw new BridgeCleared("NA", 11, 70, "subscriber required to read this board");
  }
  const items = await bridge.boardPage(board.boardId, after);
  return formatBoardPage(board.boardId, items, board.readClass);
}

export async function runBoardPost(
  bridge: Bridge,
  board: BoardService,
  body: string,
  name?: string,
): Promise<string> {
  if (board.postClass !== "PUBLIC") {
    throw new BridgeCleared("NA", 11, 70, "subscriber required to post to this board");
  }
  // De-anonymization guard: a PUBLIC-post board must never receive
  // passport-linkable context — only the transport kind.
  const receipt = await bridge.boardPost(board.boardId, body, {
    ...(name ? { name } : {}),
    ctx: { transport: "pad" },
  });
  return formatPostReceipt(receipt.no ?? "?");
}
