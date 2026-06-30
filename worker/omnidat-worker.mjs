const hostname = "omnidat.gmac.io";

const directoryEntries = [
  ["010001", "OMNIDAT FIELD OFFICE"],
  ["010110", "PACKET CLEARING DIRECTORY"],
  ["020184", "CAMP LAMINAR MESSAGE DESK"],
  ["020501", "MILIWAYS ORDER ENTRY"],
  ["030021", "PASSPORT LOG ENTRY"],
  ["030088", "BADGE CLAIMS COUNTER"],
  ["040777", "RADIO GATEWAY STATUS"],
];

const htmlHeaders = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=60",
};

const textHeaders = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "public, max-age=30",
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: jsonHeaders,
  });
}

function homepage() {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OMNIDAT Field Office</title>
  <style>
    :root {
      color-scheme: dark;
      --paper: #f3e4bf;
      --ink: #1b160f;
      --brass: #b98b45;
      --green: #9be07a;
      --panel: #17130d;
      --line: #5a4325;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(rgba(16, 13, 8, 0.88), rgba(16, 13, 8, 0.92)),
        repeating-linear-gradient(0deg, #21170b 0, #21170b 2px, #140f09 2px, #140f09 4px);
      color: var(--paper);
    }

    main {
      width: min(960px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 40px 0;
    }

    header {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 22px;
      background: rgba(23, 19, 13, 0.84);
    }

    h1 {
      margin: 0 0 10px;
      font-size: clamp(2rem, 5vw, 4rem);
      line-height: 1;
      letter-spacing: 0;
    }

    p {
      max-width: 760px;
      line-height: 1.55;
      color: #e9d9b6;
    }

    .terminal {
      margin-top: 24px;
      padding: 18px;
      border: 1px solid var(--brass);
      border-radius: 6px;
      background: #080906;
      color: var(--green);
      overflow-x: auto;
      box-shadow: inset 0 0 24px rgba(155, 224, 122, 0.08);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }

    .item {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 14px;
      background: rgba(243, 228, 191, 0.06);
      min-height: 116px;
    }

    .label {
      color: var(--brass);
      font-size: 0.78rem;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="label">Exchange 88 provisional edge office</div>
      <h1>OMNIDAT Field Office</h1>
      <p>Join the packet clearing network, request campsite circuits, and publish small applications with the same ceremony as an old digital business account.</p>
      <div class="terminal" role="region" aria-label="OMNIDAT terminal preview">
        <pre>OMNIDAT 88 READY
CALL 010110
CONNECT PACKET CLEARING DIRECTORY
DIR
${directoryText()}</pre>
      </div>
    </header>
    <section class="grid" aria-label="Network services">
      <div class="item"><div class="label">Signup</div><p>Campsites can request packet names, terminal accounts, and service circuits for the open camp namespace.</p></div>
      <div class="item"><div class="label">Transport</div><p>MeshCore / Meshtastic gateway, Wi-Fi, POTS, ShadyTel, and hosted OMNIDAT circuits remain valid access paths.</p></div>
      <div class="item"><div class="label">Apps</div><p>Create campsite apps for logs, badges, ordering, message desks, and terminal-only social services.</p></div>
    </section>
  </main>
</body>
</html>`, { headers: htmlHeaders });
}

function directoryText() {
  return directoryEntries.map(([code, label]) => `${code}  ${label}`).join("\n");
}

function directoryResponse() {
  return new Response(`OMNIDAT DIRECTORY\n${directoryText()}\n`, { headers: textHeaders });
}

function notFound() {
  return new Response("NO CARRIER\nREQUESTED CIRCUIT NOT LISTED\n", {
    status: 404,
    headers: textHeaders,
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" || url.pathname === "/api/health/live" || url.pathname === "/api/health/ready") {
      return json({
        service: "omnidat-field-office-edge",
        status: "healthy",
        hostname,
        transport: "cloudflare-worker",
        upstream: "static-provisional",
      });
    }

    if (url.pathname === "/") {
      return homepage();
    }

    if (url.pathname === "/radio" && (url.searchParams.get("command") || "").toUpperCase() === "DIR") {
      return directoryResponse();
    }

    return notFound();
  },
};
