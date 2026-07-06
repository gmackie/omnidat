#!/usr/bin/env node
// OMNIDAT telnet PAD bridge — entry point.
//
//   omnidat-pad                       # listen on 0.0.0.0:2525
//   PORT=2323 HOST=127.0.0.1 omnidat-pad
//   PAD_DTE=311088000009 PAD_IDLE=30 omnidat-pad
//
// Then attach a terminal:  telnet <host> 2525

import { createPadServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "2525", 10);
const host = process.env.HOST ?? "0.0.0.0";
const dte = process.env.PAD_DTE ?? "311088000001";
const idleSeconds = Number.parseInt(process.env.PAD_IDLE ?? "45", 10);

const server = createPadServer({ dte, idleSeconds });

server.on("error", (err) => {
  console.error(`[omnidat-pad] server error: ${err.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(
    `[omnidat-pad] OMNIDAT PAD listening on ${host}:${port} (DTE ${dte}, idle ${idleSeconds}s)`,
  );
});

function shutdown(signal: string) {
  console.log(`[omnidat-pad] ${signal} received, closing`);
  server.close(() => process.exit(0));
  // Force-exit if connections linger.
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
