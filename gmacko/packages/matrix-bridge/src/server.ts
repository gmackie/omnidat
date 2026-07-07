// The OMNIDAT bridge HTTP server.
//
// Presents the internal API the PAD clients speak (tools/omnidat_bridge.py and
// gmacko/packages/pad-telnet/src/bridge.ts): subscriber DMs and message boards,
// authenticated by a shared secret. Backed by the durable BridgeStore. Framework
// -free (node:http) so it bundles to a single standalone file for the node.

import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { Server } from "node:http";

import { BridgeStore, type StoreOptions } from "./store.js";

export interface BridgeServerOptions extends StoreOptions {
  /** Shared secret required in the x-omnidat-secret header ("" disables auth). */
  secret?: string;
  /** Inject a store (tests); otherwise one is built from StoreOptions. */
  store?: BridgeStore;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export function createBridgeServer(options: BridgeServerOptions = {}): Server {
  const secret = options.secret ?? process.env.OMNIDAT_BRIDGE_SECRET ?? "";
  const store =
    options.store ?? new BridgeStore({ path: options.path, now: options.now });

  return createServer((req, res) => {
    void handle(req, res).catch((error) => {
      // Malformed body / unexpected error → 400 so the client clears as ERR.
      send(res, 400, { error: String((error as Error)?.message ?? error) });
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Shared-secret gate (mismatch → 401, which the client maps to CLR RPE).
    if (secret && req.headers["x-omnidat-secret"] !== secret) {
      send(res, 401, { error: "bad secret" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://bridge.local");
    const path = url.pathname;
    const method = req.method ?? "GET";

    // Liveness.
    if (path === "/" || path === "/health") {
      send(res, 200, { service: "omnidat-matrix-bridge", ok: true });
      return;
    }

    // --- DMs ---
    if (path === "/dm/send" && method === "POST") {
      const body = await readJson(req);
      const from = String(body.from ?? "");
      const to = String(body.to ?? "");
      const text = String(body.body ?? "");
      if (!from || !to || !text) {
        send(res, 400, { error: "from, to and body are required" });
        return;
      }
      send(res, 200, store.sendDm(from, to, text));
      return;
    }
    const mailbox = path.match(/^\/dm\/mailbox\/(.+)$/u);
    if (mailbox && method === "GET") {
      send(res, 200, { items: store.mailbox(decodeURIComponent(mailbox[1]!)) });
      return;
    }
    if (path === "/dm/read" && method === "POST") {
      const body = await readJson(req);
      const addr = String(body.addr ?? "");
      if (!addr) {
        send(res, 400, { error: "addr is required" });
        return;
      }
      store.markRead(addr);
      send(res, 200, { ok: true });
      return;
    }

    // --- Boards ---
    const boardPage = path.match(/^\/board\/([^/]+)\/page$/u);
    if (boardPage && method === "GET") {
      const afterRaw = url.searchParams.get("after");
      const after = afterRaw === null ? undefined : Number.parseInt(afterRaw, 10);
      send(res, 200, {
        items: store.boardPage(
          decodeURIComponent(boardPage[1]!),
          Number.isNaN(after) ? undefined : after,
        ),
      });
      return;
    }
    const boardPost = path.match(/^\/board\/([^/]+)\/post$/u);
    if (boardPost && method === "POST") {
      const body = await readJson(req);
      const text = String(body.body ?? "");
      if (!text) {
        send(res, 400, { error: "body is required" });
        return;
      }
      send(
        res,
        200,
        store.boardPost(decodeURIComponent(boardPost[1]!), text, {
          name: typeof body.name === "string" ? body.name : undefined,
          thread: typeof body.thread === "string" ? body.thread : undefined,
          ctx: (body.ctx as Record<string, unknown>) ?? {},
        }),
      );
      return;
    }

    send(res, 404, { error: "no such endpoint" });
  }
}
