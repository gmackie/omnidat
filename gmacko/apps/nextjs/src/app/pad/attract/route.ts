import { attractFrames, attractStreamOnce } from "@omnidat/operator-core/attract";

export const runtime = "nodejs";

// Raw VT100 attract feed for real terminals and terminal emulators.
//
//   curl -sN https://console.omnidat.cc/pad/attract > /dev/ttyS0   # live screensaver
//   curl -s  https://console.omnidat.cc/pad/attract?raw=1          # one flat cycle
//   while :; do curl -sN https://console.omnidat.cc/pad/attract; done  # loop on hw
//
// Default: a server-paced streaming response that plays exactly one cycle
// (~18s) then closes, so a shell loop drives an endless screensaver without
// pinning a Worker open. `?raw=1` returns the whole cycle at once (fast-forward,
// good for piping). `?loop=1` streams cycles back-to-back until the client
// disconnects (use with care — holds the connection open).
const TEXT_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store",
  "x-omnidat": "attract",
} as const;

export function GET(request: Request): Response {
  const url = new URL(request.url);

  if (url.searchParams.has("raw")) {
    return new Response(attractStreamOnce(), { headers: TEXT_HEADERS });
  }

  const loop = url.searchParams.has("loop");
  const frames = attractFrames();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        send("\x1bc"); // RIS — reset the terminal to a known state
        do {
          for (const frame of frames) {
            send(frame.bytes);
            await new Promise((resolve) => setTimeout(resolve, frame.ms));
          }
        } while (loop);
        send("\x1b[H"); // home the cursor so a re-invocation starts clean
        controller.close();
      } catch {
        // Client disconnected (broken pipe) — stop quietly.
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, { headers: TEXT_HEADERS });
}
