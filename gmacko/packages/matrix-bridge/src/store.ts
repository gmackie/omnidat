// The OMNIDAT bridge store.
//
// A self-contained, durable backing store for subscriber mail (store-and-forward
// DMs) and message boards. It presents the shapes the PAD clients expect and
// persists every mutation to an append-only JSONL log so the bridge survives a
// restart at camp with no external database — the field-kit-journal-first model
// (docs/protocol-fidelity.md). A real Matrix homeserver can be layered behind
// this same interface later; the wire contract to the PADs does not change.
//
// Pure and injectable: pass a clock and disable persistence for tests.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export interface DmReceipt {
  rcpt: string;
  eventId: string;
}
export interface MailItem {
  no: number;
  from: string;
  ts: string; // terse HH:MM (the mailbox API returns pre-formatted times)
  body: string;
}
export interface BoardReceipt {
  no: number;
  eventId: string;
}
export interface DeliveryStatus {
  rcpt: string;
  to: string;
  delivered: boolean;
  read: boolean;
  readAt?: string; // terse HH:MM when read
}
export interface BoardItem {
  no: number;
  poster: string;
  ts: number; // epoch ms (board pages return raw timestamps)
  body: string;
  eventId: string;
}

interface StoredDm {
  no: number;
  from: string;
  to: string;
  at: number; // epoch ms
  body: string;
  read: boolean;
  readAt?: number;
  rcpt: string;
  eventId: string;
}
interface StoredPost {
  no: number;
  poster: string;
  at: number;
  body: string;
  eventId: string;
  thread?: string;
  ctx: Record<string, unknown>;
}

// Append-only journal ops.
type Op =
  | {
      t: "dm";
      to: string;
      from: string;
      no: number;
      at: number;
      body: string;
      rcpt: string;
      eventId: string;
    }
  | { t: "read"; addr: string; at: number }
  | {
      t: "post";
      board: string;
      no: number;
      poster: string;
      at: number;
      body: string;
      eventId: string;
      thread?: string;
      ctx: Record<string, unknown>;
    };

export interface StoreOptions {
  /** JSONL journal path for durability; omit for an ephemeral in-memory store. */
  path?: string;
  /** Injectable clock (epoch ms). */
  now?: () => number;
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export class BridgeStore {
  private mail = new Map<string, StoredDm[]>();
  private boards = new Map<string, StoredPost[]>();
  private byRcpt = new Map<string, StoredDm>();
  private dmSeq = new Map<string, number>();
  private boardSeq = new Map<string, number>();
  private rcptSeq = 0;
  private eventSeq = 0;
  private readonly path?: string;
  private readonly now: () => number;

  constructor(options: StoreOptions = {}) {
    this.path = options.path;
    this.now = options.now ?? (() => Date.now());
    if (this.path) this.replay(this.path);
  }

  private nextEventId(): string {
    this.eventSeq += 1;
    return `$evt-${this.eventSeq.toString(36)}`;
  }

  private append(op: Op): void {
    if (!this.path) return;
    appendFileSync(this.path, `${JSON.stringify(op)}\n`);
  }

  private apply(op: Op): void {
    if (op.t === "dm") {
      const box = this.mail.get(op.to) ?? [];
      const msg: StoredDm = {
        no: op.no,
        from: op.from,
        to: op.to,
        at: op.at,
        body: op.body,
        read: false,
        rcpt: op.rcpt,
        eventId: op.eventId,
      };
      box.push(msg);
      this.mail.set(op.to, box);
      this.byRcpt.set(op.rcpt, msg);
      this.dmSeq.set(op.to, Math.max(this.dmSeq.get(op.to) ?? 0, op.no));
    } else if (op.t === "read") {
      for (const m of this.mail.get(op.addr) ?? []) {
        if (!m.read) {
          m.read = true;
          m.readAt = op.at;
        }
      }
    } else {
      const posts = this.boards.get(op.board) ?? [];
      posts.push({
        no: op.no,
        poster: op.poster,
        at: op.at,
        body: op.body,
        eventId: op.eventId,
        thread: op.thread,
        ctx: op.ctx,
      });
      this.boards.set(op.board, posts);
      this.boardSeq.set(op.board, Math.max(this.boardSeq.get(op.board) ?? 0, op.no));
    }
  }

  private replay(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(dirname(path), { recursive: true });
      return;
    }
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const op = JSON.parse(line) as Op;
        this.apply(op);
        // Keep counters ahead of anything replayed.
        if (op.t === "dm") this.rcptSeq += 1;
        if (op.t !== "read") this.eventSeq += 1;
      } catch {
        /* skip a corrupt trailing line */
      }
    }
  }

  // ---- DMs -------------------------------------------------------------

  sendDm(from: string, to: string, body: string): DmReceipt {
    const no = (this.dmSeq.get(to) ?? 0) + 1;
    const at = this.now();
    const eventId = this.nextEventId();
    this.rcptSeq += 1;
    const rcpt = `MSG-${String(this.rcptSeq).padStart(5, "0")}`;
    const op: Op = { t: "dm", to, from, no, at, body, rcpt, eventId };
    this.apply(op);
    this.append(op);
    return { rcpt, eventId };
  }

  mailbox(addr: string): MailItem[] {
    return (this.mail.get(addr) ?? [])
      .filter((m) => !m.read)
      .map((m) => ({ no: m.no, from: m.from, ts: hhmm(m.at), body: m.body }));
  }

  markRead(addr: string): void {
    const op: Op = { t: "read", addr, at: this.now() };
    this.apply(op);
    this.append(op);
  }

  /** Delivery status of a sent telegram by its receipt (030031). */
  receipt(rcpt: string): DeliveryStatus | undefined {
    const m = this.byRcpt.get(rcpt);
    if (!m) return undefined;
    return {
      rcpt,
      to: m.to,
      delivered: true,
      read: m.read,
      ...(m.readAt !== undefined ? { readAt: hhmm(m.readAt) } : {}),
    };
  }

  // ---- Boards ----------------------------------------------------------

  boardPost(
    board: string,
    body: string,
    opts: { name?: string; thread?: string; ctx?: Record<string, unknown> } = {},
  ): BoardReceipt {
    const no = (this.boardSeq.get(board) ?? 0) + 1;
    const at = this.now();
    const eventId = this.nextEventId();
    const op: Op = {
      t: "post",
      board,
      no,
      poster: opts.name?.trim() || "anon",
      at,
      body,
      eventId,
      ...(opts.thread ? { thread: opts.thread } : {}),
      ctx: opts.ctx ?? {},
    };
    this.apply(op);
    this.append(op);
    return { no, eventId };
  }

  boardPage(board: string, after?: number): BoardItem[] {
    return (this.boards.get(board) ?? [])
      .filter((p) => after === undefined || p.no > after)
      .map((p) => ({ no: p.no, poster: p.poster, ts: p.at, body: p.body, eventId: p.eventId }));
  }
}
