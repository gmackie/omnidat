#!/usr/bin/env node
// OMNIDAT bridge server — entry point.
//
//   OMNIDAT_BRIDGE_SECRET=... omnidat-bridge-server
//   PORT=8090 HOST=127.0.0.1 BRIDGE_STORE=/opt/omnidat-bridge/data/journal.jsonl
//
// Bind to localhost by default: only the co-located PAD (127.0.0.1:8090) talks
// to it, so the bridge is never internet-facing.

import { createBridgeServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "8090", 10);
const host = process.env.HOST ?? "127.0.0.1";
const secret = process.env.OMNIDAT_BRIDGE_SECRET ?? "";
const path = process.env.BRIDGE_STORE || undefined;

const server = createBridgeServer({ secret, path });

server.on("error", (err) => {
  console.error(`[omnidat-bridge] server error: ${err.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(
    `[omnidat-bridge] listening on ${host}:${port} (store ${path ?? "ephemeral"}, auth ${secret ? "on" : "off"})`,
  );
});

function shutdown(signal: string) {
  console.log(`[omnidat-bridge] ${signal} received, closing`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
