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

const businessExamples = [
  {
    slug: "miliways-line-management",
    title: "Miliways Line Management",
    department: "Department of Recreational Commerce",
    summary: "Food orders, queue tickets, counter status, and late-night receipt printing over X.25 circuits.",
    circuit: "020501",
  },
  {
    slug: "activity-passport",
    title: "Activity Passport Bureau",
    department: "Packet Utility Commission",
    summary: "Log visits, stamp activities, and issue merit-badge claims without leaving the terminal session.",
    circuit: "030021",
  },
  {
    slug: "camp-app-exchange",
    title: "Camp Application Exchange",
    department: "Executive Circuit Provisioning",
    summary: "Campsites create apps, request circuit numbers, and publish directory listings in the open camp namespace.",
    circuit: "010110",
  },
  {
    slug: "radio-pad",
    title: "Radio PAD Desk",
    department: "Office of Field Telecommunications",
    summary: "Bridge MeshCore, Meshtastic, Wi-Fi, POTS, ShadyTel, and hosted paths into the same old digital terminal.",
    circuit: "040777",
  },
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
  <title>OMNIDAT X.25 Packet Clearing Network</title>
  <style>
    :root {
      color-scheme: dark;
      --paper: #f1e2bd;
      --muted: #d4bd8a;
      --ink: #1b160f;
      --brass: #b98b45;
      --green: #9be07a;
      --red: #d76d53;
      --blue: #8bb7d9;
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
      width: min(1180px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 28px 0 44px;
    }

    header {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 24px;
      background: rgba(23, 19, 13, 0.84);
    }

    .masthead {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
      gap: 22px;
      align-items: start;
    }

    h1 {
      margin: 8px 0 12px;
      font-size: clamp(2.1rem, 7vw, 5.8rem);
      line-height: 0.92;
      letter-spacing: 0;
    }

    h2 {
      margin: 0 0 12px;
      font-size: 1.18rem;
      color: var(--blue);
      letter-spacing: 0;
    }

    p {
      margin: 0;
      line-height: 1.55;
      color: #e9d9b6;
    }

    .terminal {
      padding: 18px;
      border: 1px solid var(--brass);
      border-radius: 6px;
      background: #080906;
      color: var(--green);
      overflow-x: auto;
      box-shadow: inset 0 0 24px rgba(155, 224, 122, 0.08);
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.45;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }

    .item {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 14px;
      background: rgba(243, 228, 191, 0.06);
      min-height: 126px;
    }

    .label {
      color: var(--brass);
      font-size: 0.78rem;
      text-transform: uppercase;
    }

    .seal {
      display: inline-block;
      border: 1px solid var(--brass);
      color: var(--brass);
      padding: 4px 8px;
      margin-right: 8px;
      text-transform: uppercase;
      font-size: 0.78rem;
    }

    .tagline {
      color: var(--green);
      font-size: 1rem;
      text-transform: uppercase;
    }

    .band {
      margin-top: 18px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(12, 10, 7, 0.72);
    }

    .ledger {
      display: grid;
      grid-template-columns: 170px 1fr;
      gap: 10px 16px;
      margin-top: 16px;
      color: var(--muted);
    }

    .ledger div:nth-child(odd) {
      color: var(--brass);
      text-transform: uppercase;
    }

    .examples,
    .samples {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }

    .example h3 {
      margin: 8px 0;
      font-size: 1rem;
      color: var(--paper);
    }

    .bureau {
      color: var(--red);
      font-size: 0.78rem;
      text-transform: uppercase;
    }

    .sample pre {
      min-height: 174px;
    }

    @media (max-width: 760px) {
      .masthead {
        grid-template-columns: 1fr;
      }

      .ledger {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="masthead">
        <div>
          <div><span class="seal">Exchange 88 v1 edge office</span><span class="tagline">The Future of Business Innovation</span></div>
          <h1>X.25 Packet Clearing Network</h1>
          <p>OMNIDAT Field Office provisions campsite businesses, terminal applications, and recreational commerce circuits with the confidence of a regulated monopoly and the convenience of a blinking cursor.</p>
          <div class="ledger" aria-label="Corporate network filing facts">
            <div>Authority</div><div>Packet Utility Commission, Department of Recreational Commerce</div>
            <div>Product</div><div>X.25 network access for camps, villages, kitchens, badge desks, message offices, and future-forward business innovation</div>
            <div>Transport</div><div>MeshCore, Meshtastic, Wi-Fi, POTS, ShadyTel, and hosted OMNIDAT circuits</div>
            <div>Namespace</div><div>Open camp namespace with optional private corporate registries</div>
          </div>
        </div>
        <div class="terminal" role="region" aria-label="OMNIDAT terminal preview">
          <pre>OMNIDAT 88 READY
CALL 010110
CONNECT PACKET CLEARING DIRECTORY
DIR
${directoryText()}</pre>
        </div>
      </div>
    </header>

    <section class="band" aria-label="Executive circuit provisioning">
      <h2>Executive Circuit Provisioning</h2>
      <p>Join the packet clearing network, request campsite circuits, and publish small applications with the same ceremony as an old digital business account. Your campsite receives an account, a namespace, a directory listing, and the opportunity to perform enterprise activity on equipment nobody should still trust.</p>
      <div class="grid" aria-label="Network services">
        <div class="item"><div class="label">Signup</div><p>Campsites request packet names, terminal accounts, and service circuits for the open camp namespace.</p></div>
        <div class="item"><div class="label">Transport</div><p>MeshCore / Meshtastic gateway, Wi-Fi, POTS, ShadyTel, and hosted OMNIDAT circuits remain valid access paths.</p></div>
        <div class="item"><div class="label">Apps</div><p>Create campsite apps for logs, badges, ordering, message desks, and terminal-only social services.</p></div>
        <div class="item"><div class="label">Tariff</div><p>Accounting is ceremonial until ShadyBank certifies settlement, invoices, and outstanding packet obligations.</p></div>
      </div>
    </section>

    <section class="band" aria-label="Business innovation examples">
      <h2>Corporate Applications for the Campsite Enterprise</h2>
      <div class="examples">
        ${businessExamples.map((example) => `<div class="item example"><div class="bureau">${example.department}</div><h3>${example.title}</h3><p>${example.summary}</p><div class="label">Circuit ${example.circuit}</div></div>`).join("")}
      </div>
    </section>

    <section class="band" aria-label="Terminal examples">
      <h2>Approved Terminal Procedures</h2>
      <div class="samples">
        <div class="terminal sample"><pre>OPEN CAMP.MILIWAYS
ACCOUNT: CAMP-LAMINAR
ITEM: NOODLE CUP
QTY: 2
RETURN: LINE-TICKET

ORDER STATUS: RECEIVED
COUNTER WINDOW: 3
ESTIMATED WAIT: 09 MIN</pre></div>
        <div class="terminal sample"><pre>SUBMIT PASSPORT.LOG
BADGE: NIGHT-OWL-TERMINAL
OPERATOR: LAMINAR-184
EVIDENCE: VISITED RADIO PAD

STAMP: FILED
MERIT CLAIM: PENDING
RECEIPT: 030021-8842</pre></div>
        <div class="terminal sample"><pre>CREATE APP CAMP.SUNDIAL
TITLE: SOLAR TEA TIMER
NAMESPACE: CAMP
TRANSPORT: MESHCORE

CIRCUIT REQUEST: QUEUED
OFFICE: EXECUTIVE CIRCUIT PROVISIONING
EXPECT: ABSURD PAPERWORK</pre></div>
      </div>
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

function businessExampleResponse() {
  return json({
    service,
    network: "X.25 Packet Clearing Network",
    examples: businessExamples,
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

    if (url.pathname === "/api/business-examples") {
      return businessExampleResponse();
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
