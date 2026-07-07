// Bridge-backed PAD messaging: subscriber MAIL/MSG, telegram delivery status,
// and message boards.
//
// These verbs ride the OMNIDAT Matrix bridge (see bridge.ts). The board/mail
// catalog is fetched from the bridge (GET /boards) — the single source of truth
// shared with the Python PAD — rather than hard-coded here. The on-screen formats
// mirror the Python packet tool so both PADs present the same thing. Output is
// plain line-oriented text; the caller runs it through the terminal personality
// so it renders on VT100 / ADM-3A / ASR-33 alike.

import type {
  BoardDef,
  BoardItem,
  Bridge,
  Catalog,
  DeliveryStatus,
  MailItem,
} from "./bridge.js";
import { BridgeCleared } from "./bridge.js";

const CRLF = "\r\n";

/** Resolve an X.121 address against the fetched catalog. */
export function resolveCatalog(
  catalog: Catalog,
  address: string,
): { kind: "board"; board: BoardDef } | { kind: "mail" } | undefined {
  if (catalog.mail && address === catalog.mail.address) return { kind: "mail" };
  const board = catalog.boards.find((b) => b.address === address);
  return board ? { kind: "board", board } : undefined;
}

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
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function formatSendReceipt(rcpt: unknown): string {
  return `MSG SENT RCPT ${rcpt} CLR 00`;
}

export function formatDelivery(s: DeliveryStatus): string {
  const state = s.read
    ? `READ${s.readAt ? ` ${s.readAt}` : ""}`
    : s.delivered
      ? "DELIVERED — UNREAD"
      : "PENDING";
  return [`TELEGRAM ${s.rcpt}`, `TO ${s.to}  ${state}`, "CLR 00"].join(CRLF);
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

export async function runSent(bridge: Bridge, rcpt: string): Promise<string> {
  return formatDelivery(await bridge.receipt(rcpt));
}

export async function runBoardRead(
  bridge: Bridge,
  board: BoardDef,
  after?: number,
): Promise<string> {
  if (board.readClass !== "PUBLIC") {
    throw new BridgeCleared("NA", 11, 70, "subscriber required to read this board");
  }
  const items = await bridge.boardPage(board.boardId, after);
  return formatBoardPage(board.boardId, items, board.readClass);
}

export async function runBoardPost(
  bridge: Bridge,
  board: BoardDef,
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
