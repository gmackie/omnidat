const hostname = "omnidat.gmac.io";
const service = "omnidat-v1-worker";

const directoryEntries = [
  { circuit: "010001", label: "OMNIDAT FIELD OFFICE", kind: "network-office", slug: "field-office" },
  { circuit: "010110", label: "PACKET CLEARING DIRECTORY", kind: "directory", slug: "directory" },
  { circuit: "020184", label: "CAMP LAMINAR MESSAGE DESK", kind: "campsite-app", slug: "camp-laminar" },
  { circuit: "020501", label: "MILIWAYS ORDER ENTRY", kind: "campsite-app", slug: "miliways" },
  { circuit: "030021", label: "PASSPORT LOG ENTRY", kind: "campsite-app", slug: "passport" },
  { circuit: "030088", label: "BADGE CLAIMS COUNTER", kind: "campsite-app", slug: "badges" },
  { circuit: "040777", label: "RADIO GATEWAY STATUS", kind: "transport", slug: "radio-gateway" },
];

const transportProfiles = [
  { slug: "meshcore", label: "MeshCore packet gateway" },
  { slug: "meshtastic", label: "Meshtastic packet gateway" },
  { slug: "wifi", label: "Camp Wi-Fi terminal" },
  { slug: "pots", label: "POTS acoustic terminal" },
  { slug: "shadytel", label: "ShadyTel hosted circuit" },
  { slug: "omnidat-hosted", label: "OMNIDAT hosted circuit" },
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
      <div class="label">Exchange 88 v1 edge office</div>
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
  return directoryEntries.map((entry) => `${entry.circuit}  ${entry.label}`).join("\n");
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

function health() {
  return json({
    service,
    status: "healthy",
    hostname,
    transport: "cloudflare-worker",
    database: "postgres-shared-fryos-v1",
    schema: "omnidat",
    upstream: "cloudflare-workers",
  });
}

function campsiteApps() {
  return json({
    service,
    namespace: "camp",
    apps: directoryEntries
      .filter((entry) => entry.kind === "campsite-app")
      .map((entry) => ({
        circuit: entry.circuit,
        slug: entry.slug,
        label: entry.label,
        namespace: "camp",
      })),
  });
}

async function signup(request) {
  if (request.method !== "POST") {
    return json({
      status: "rejected",
      error: "POST required for campsite signup requests.",
    }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({
      status: "rejected",
      error: "Valid JSON request body required.",
    }, 400);
  }

  const campsiteName = String(payload.campsiteName || "").trim();
  const contact = String(payload.contact || "").trim();
  const namespace = String(payload.namespace || "camp").trim() || "camp";
  const transport = String(payload.transport || "").trim();

  if (!campsiteName || !contact || !transport) {
    return json({
      status: "rejected",
      error: "campsiteName, contact, and transport are required.",
    }, 400);
  }

  return json({
    service,
    status: "queued",
    message: `${campsiteName} is queued for OMNIDAT circuit review.`,
    request: {
      campsiteName,
      contact,
      namespace,
      transport,
    },
  }, 202);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" || url.pathname === "/api/health/live" || url.pathname === "/api/health/ready") {
      return health();
    }

    if (url.pathname === "/") {
      return homepage();
    }

    if (url.pathname === "/api/campsite-apps") {
      return campsiteApps();
    }

    if (url.pathname === "/api/signup") {
      return signup(request);
    }

    if (url.pathname === "/api/transports") {
      return json({ service, transports: transportProfiles });
    }

    if (url.pathname === "/radio" && (url.searchParams.get("command") || "").toUpperCase() === "DIR") {
      return directoryResponse();
    }

    return notFound();
  },
};
