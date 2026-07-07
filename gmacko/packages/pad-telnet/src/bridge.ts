// Client for the OMNIDAT Matrix bridge internal HTTP API.
//
// The bridge is a small HTTP service (OMNIDAT_BRIDGE_URL, default
// 127.0.0.1:8090) that fronts a Matrix homeserver: subscriber DMs (store and
// forward "SUBSCRIBER MAIL") and public/registered message boards. This mirrors
// the Python client (tools/omnidat_bridge.py) byte-for-byte on the wire so both
// PADs speak to one backend. Every failure maps to an honest X.25 clear cause
// (docs/protocol-fidelity.md) rather than a leaked stack trace — including
// "bridge offline", which is the state today until the bridge server is
// deployed.

export interface BridgeReceipt {
  no?: number;
  eventId?: string;
  [key: string]: unknown;
}
export interface MailItem {
  from?: string;
  body?: string;
  ts?: unknown;
  [key: string]: unknown;
}
export interface BoardItem {
  no: number;
  poster?: string;
  body?: string;
  ts?: unknown;
  eventId?: string;
  [key: string]: unknown;
}

/** An X.25 clear raised when a bridge call cannot complete. */
export class BridgeCleared extends Error {
  constructor(
    readonly signal: string,
    readonly cause: number,
    readonly diagnostic: number,
    detail = "",
  ) {
    super(detail || signal);
    this.name = "BridgeCleared";
  }
  get clrLine(): string {
    return `CLR ${this.signal} C:${this.cause} D:${this.diagnostic}`;
  }
}

/** Map a bridge HTTP status to an X.25 clear (matches the Python client). */
function clearedForStatus(status: number, detail = ""): BridgeCleared {
  if (status === 400) return new BridgeCleared("ERR", 19, 0, detail);
  if (status === 403) return new BridgeCleared("NA", 11, 70, detail);
  if (status === 404) return new BridgeCleared("NP", 13, 0, detail);
  // 401 (secret mismatch) and 5xx: the bridge violated the edge↔bridge contract.
  return new BridgeCleared("RPE", 17, 0, detail);
}

export interface Bridge {
  sendDm(from: string, to: string, body: string): Promise<BridgeReceipt>;
  mailbox(addr: string): Promise<MailItem[]>;
  markRead(addr: string): Promise<unknown>;
  boardPage(boardId: string, after?: number): Promise<BoardItem[]>;
  boardPost(
    boardId: string,
    body: string,
    opts?: { name?: string; thread?: string; ctx?: Record<string, unknown> },
  ): Promise<BridgeReceipt>;
}

export interface MatrixBridgeOptions {
  baseUrl?: string;
  secret?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

export class MatrixBridge implements Bridge {
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: MatrixBridgeOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.OMNIDAT_BRIDGE_URL ??
      "http://127.0.0.1:8090"
    ).replace(/\/+$/u, "");
    this.secret = options.secret ?? process.env.OMNIDAT_BRIDGE_SECRET ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 4000;
  }

  sendDm(from: string, to: string, body: string): Promise<BridgeReceipt> {
    return this.request("POST", "/dm/send", { from, to, body });
  }
  async mailbox(addr: string): Promise<MailItem[]> {
    const res = await this.request<{ items: MailItem[] }>(
      "GET",
      `/dm/mailbox/${encodeURIComponent(addr)}`,
    );
    return res.items ?? [];
  }
  markRead(addr: string): Promise<unknown> {
    return this.request("POST", "/dm/read", { addr });
  }
  async boardPage(boardId: string, after?: number): Promise<BoardItem[]> {
    const q = after !== undefined ? `?after=${after}` : "";
    const res = await this.request<{ items: BoardItem[] }>(
      "GET",
      `/board/${encodeURIComponent(boardId)}/page${q}`,
    );
    return res.items ?? [];
  }
  boardPost(
    boardId: string,
    body: string,
    opts: { name?: string; thread?: string; ctx?: Record<string, unknown> } = {},
  ): Promise<BridgeReceipt> {
    const payload: Record<string, unknown> = { body, ctx: opts.ctx ?? {} };
    if (opts.name !== undefined) payload.name = opts.name;
    if (opts.thread !== undefined) payload.thread = opts.thread;
    return this.request("POST", `/board/${encodeURIComponent(boardId)}/post`, payload);
  }

  private async request<T = BridgeReceipt>(
    method: string,
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "x-omnidat-secret": this.secret,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw clearedForStatus(response.status, detail.slice(0, 200));
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BridgeCleared) throw error;
      // Offline / unreachable / aborted: the transport endpoint is down.
      throw new BridgeCleared("DER", 9, 0, String((error as Error)?.message ?? error));
    } finally {
      clearTimeout(timer);
    }
  }
}
