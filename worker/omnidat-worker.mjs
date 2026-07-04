const hostname = "omnidat.gmac.io";
const service = "omnidat-v1-worker";
const appUrl = "https://omnidat.gmac.io";

const authProviders = [
  {
    id: "omniauth",
    name: "OmniAuth Passkey",
    protocol: "oauth-passkey",
    clientId: "omnidat-field-office",
    authorizationUrl: "https://omniauth.gmac.io/oauth/authorize",
    tokenUrl: "https://omniauth.gmac.io/oauth/token",
    profileUrl: "https://omniauth.gmac.io/api/user",
    callbackUrl: `${appUrl}/api/auth/callback/omniauth`,
    scopes: ["openid", "profile", "email", "passkey", "shadybucks"],
  },
  {
    id: "forgegraph",
    name: "ForgeGraph OAuth",
    protocol: "oidc",
    clientId: "omnidat-field-office",
    authorizationUrl: "https://forgegraf.com/api/auth/oauth2/authorize",
    tokenUrl: "https://forgegraf.com/api/auth/oauth2/token",
    profileUrl: "https://forgegraf.com/api/auth/oauth2/userinfo",
    callbackUrl: `${appUrl}/api/auth/callback/forgegraph`,
    scopes: ["openid", "profile", "email"],
  },
  {
    id: "github",
    name: "GitHub OAuth",
    protocol: "oauth",
    clientId: "omnidat-field-office",
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    profileUrl: "https://api.github.com/user",
    callbackUrl: `${appUrl}/api/auth/callback/github`,
    scopes: ["read:user", "user:email"],
  },
];

const legacyProviderAliases = {
  "shadytel-omniauth": "omniauth",
  shadytel: "omniauth",
};

function authProvider(id = "omniauth") {
  const canonicalId = legacyProviderAliases[id] || id;
  return authProviders.find((provider) => provider.id === canonicalId) || null;
}

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

const serviceDefinitions = [
  {
    slug: "directory",
    name: "Packet Clearing Directory",
    x121: "311088010110",
    status: "up",
    reachable: true,
    owner: "OMNIDAT",
    verbs: [
      { name: "DIR", inputs: ["namespace"], outputs: ["entries", "x121", "serviceName"] },
      { name: "LOOKUP", inputs: ["x121"], outputs: ["service", "verbs", "status"] },
    ],
  },
  {
    slug: "food-service",
    name: "Miliways Order Entry",
    x121: "311088020501",
    status: "up",
    reachable: true,
    owner: "Department of Recreational Commerce",
    verbs: [
      { name: "MENU", inputs: ["serviceId"], outputs: ["items", "prices", "waitLines"] },
      { name: "QUOTE", inputs: ["itemIds", "shadybucksAccountId"], outputs: ["total", "currency", "estimatedWait"] },
      { name: "ORDER.CREATE", inputs: ["itemIds", "pickupName", "shadybucksAccountId"], outputs: ["orderId", "lineTicket", "receiptId"] },
      { name: "ORDER.STATUS", inputs: ["orderId"], outputs: ["status", "window", "estimatedWait"] },
    ],
  },
  {
    slug: "activity-passport",
    name: "Passport Log Entry",
    x121: "311088030021",
    status: "up",
    reachable: true,
    owner: "Packet Utility Commission",
    verbs: [
      { name: "STAMP", inputs: ["badge", "operatorId", "evidence"], outputs: ["stampId", "meritClaimStatus"] },
      { name: "CLAIM.STATUS", inputs: ["stampId"], outputs: ["status", "reviewer", "receiptId"] },
    ],
  },
  {
    slug: "shadybucks-atm",
    name: "ShadyBucks ATM PAD",
    x121: "311088030100",
    status: "up",
    reachable: true,
    owner: "ShadyBucks Settlement Office",
    verbs: [
      { name: "ATM.SETUP", inputs: ["terminalId", "settlementAccountId", "x121"], outputs: ["atmId", "activationCode", "receiptId"] },
      { name: "BALANCE", inputs: ["shadybucksAccountId"], outputs: ["availableBalance", "currency"] },
      { name: "WITHDRAW", inputs: ["shadybucksAccountId", "amount"], outputs: ["receiptId", "authorizationCode"] },
      { name: "DEPOSIT", inputs: ["shadybucksAccountId", "amount"], outputs: ["receiptId", "postedBalance"] },
    ],
  },
  {
    slug: "radio-pad",
    name: "Radio Gateway Status",
    x121: "311088040777",
    status: "degraded",
    reachable: true,
    owner: "Office of Field Telecommunications",
    verbs: [
      { name: "PING", inputs: ["transport"], outputs: ["latencyMs", "packetLoss", "status"] },
      { name: "TRACE", inputs: ["destinationX121"], outputs: ["hops", "transportPath"] },
    ],
  },
];

const billingAccounts = [
  {
    accountId: "SB-CAMP-LAMINAR-001",
    provider: "ShadyBucks",
    type: "camp-operating",
    owner: "Camp Laminar",
    status: "linked-demo",
    balance: 1288,
    currency: "SHDY",
  },
  {
    accountId: "SB-ATM-EX88-100",
    provider: "ShadyBucks",
    type: "atm-settlement",
    owner: "Exchange 88 ATM Desk",
    status: "ready-for-terminal",
    balance: 5000,
    currency: "SHDY",
  },
];

const provisioningQueue = [
  {
    id: "PV-020184",
    campsiteName: "Camp Laminar",
    namespace: "camp",
    transport: "meshcore",
    assignedX121: "311088020184",
    status: "pending-network-install",
  },
];

const circuitState = [
  { x121: "311088010110", service: "Packet Clearing Directory", status: "up", latencyMs: 42, transport: "cloudflare-worker" },
  { x121: "311088020501", service: "Miliways Order Entry", status: "up", latencyMs: 88, transport: "meshcore-pad" },
  { x121: "311088030100", service: "ShadyBucks ATM PAD", status: "up", latencyMs: 74, transport: "shadytel-hosted" },
  { x121: "311088040777", service: "Radio Gateway Status", status: "degraded", latencyMs: 240, transport: "meshtastic-pad" },
];

const foodProtocol = {
  protocol: "OMNIDAT-FOOD-1",
  serviceSlug: "food-service",
  x121: "311088020501",
  currency: "SHDY",
  menu: [
    { itemId: "NOODLE-CUP", name: "Noodle Cup", priceShadyBucks: 7, available: true },
    { itemId: "TEA-THERMOS", name: "Thermos Tea", priceShadyBucks: 4, available: true },
    { itemId: "NIGHT-PLATE", name: "Night Plate", priceShadyBucks: 13, available: false },
  ],
  waitLines: [
    { lineId: "WINDOW-3", label: "Counter Window 3", status: "accepting-orders", estimatedWaitMinutes: 9 },
    { lineId: "LATE-NIGHT", label: "Late Night Queue", status: "paused", estimatedWaitMinutes: 0 },
  ],
  verbs: serviceDefinitions.find((entry) => entry.slug === "food-service").verbs,
};

const shadybucksAtmProtocol = {
  protocol: "SHADYBUCKS-ATM-X25-1",
  serviceSlug: "shadybucks-atm",
  x121: "311088030100",
  settlementNetwork: "ShadyBucks",
  setupChecklist: [
    "Assign X.121 terminal address",
    "Bind terminal to ShadyBucks settlement account",
    "Verify BALANCE and WITHDRAW verbs over X.25",
    "Print activation receipt for the camp operator",
  ],
  verbs: serviceDefinitions.find((entry) => entry.slug === "shadybucks-atm").verbs,
};

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

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function base64UrlEncode(value) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

async function sessionSignature(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

async function encodeSession(session, secret) {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = await sessionSignature(payload, secret);
  return `${payload}.${signature}`;
}

async function decodeSession(value, secret) {
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) {
      return null;
    }
    const expected = await sessionSignature(payload, secret);
    if (signature !== expected) {
      return null;
    }
    return JSON.parse(base64UrlDecode(payload));
  } catch {
    return null;
  }
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : "";
}

async function sessionCookie(session, secret) {
  return `omnidat_session=${await encodeSession(session, secret)}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax`;
}

async function currentSession(request, env = {}) {
  return decodeSession(cookieValue(request, "omnidat_session"), authSecret(env));
}

function hasRole(session, roles) {
  const userRoles = session?.user?.roles || [];
  return roles.some((role) => userRoles.includes(role));
}

function loginRedirect(request) {
  const url = new URL(request.url);
  return redirect(`/login?returnTo=${encodeURIComponent(url.pathname)}`);
}

function forbiddenPage() {
  return new Response("INSUFFICIENT CLEARANCE\nCONTACT PACKET UTILITY COMMISSION\n", {
    status: 403,
    headers: textHeaders,
  });
}

async function requirePageSession(request, env, roles, handler) {
  const session = await currentSession(request, env);
  if (!session) {
    return loginRedirect(request);
  }
  if (!hasRole(session, roles)) {
    return forbiddenPage();
  }
  return handler(session);
}

async function requireApiSession(request, env, roles, handler) {
  const session = await currentSession(request, env);
  if (!session) {
    return json({ error: "authentication required" }, 401);
  }
  if (!hasRole(session, roles)) {
    return json({ error: "insufficient clearance" }, 403);
  }
  return handler(session);
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

    a {
      color: inherit;
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
          <div><span class="seal">Exchange 88 v1 edge office</span><span class="tagline"><a href="https://haha.business/" rel="noopener">The Future of Business Innovation</a></span></div>
          <h1>X.25 Packet Clearing Network</h1>
          <p>OMNIDAT Field Office provisions campsite <a href="https://haha.business/" rel="noopener">business</a> accounts, terminal applications, and recreational commerce circuits with the confidence of a regulated monopoly and the convenience of a blinking cursor.</p>
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

function operationalPage(title, body) {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - OMNIDAT</title>
  <style>
    :root {
      color-scheme: dark;
      --paper: #f1e2bd;
      --muted: #d4bd8a;
      --green: #9be07a;
      --blue: #8bb7d9;
      --red: #d76d53;
      --line: #5a4325;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #110f0b;
      color: var(--paper);
    }
    main {
      width: min(1180px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 28px 0 44px;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 18px;
    }
    a { color: var(--green); }
    h1 { margin: 0 0 10px; font-size: clamp(2rem, 5vw, 4.8rem); line-height: 0.95; letter-spacing: 0; }
    h2 { color: var(--blue); font-size: 1.1rem; letter-spacing: 0; }
    p { color: #e9d9b6; line-height: 1.55; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 12px;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(243, 228, 191, 0.06);
      padding: 14px;
    }
    .label { color: var(--muted); text-transform: uppercase; font-size: 0.78rem; }
    pre {
      margin: 0;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #080906;
      color: var(--green);
      overflow-x: auto;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <main>
    <nav>
      <a href="/">Field Office</a>
      <a href="/login">Login</a>
      <a href="/console">Console</a>
      <a href="/admin">Admin</a>
      <a href="/noc">NOC</a>
    </nav>
    ${body}
  </main>
</body>
</html>`, { headers: htmlHeaders });
}

function loginPage() {
  const providerPanels = authProviders.map((provider) => `
      <section class="panel">
        <div class="label">${provider.name}</div>
        <p><a href="/api/auth/${provider.id}?returnTo=/console">Continue with ${provider.name}</a></p>
        <p>Provider: ${provider.id}</p>
      </section>`).join("");
  return operationalPage("Login", `
    <h1>Operator Login</h1>
    <p>OMNIDAT accepts OmniAuth passkeys, ForgeGraph OAuth, and GitHub OAuth for field-office identity. Use one of these shared services to configure PDFs, ShadyBucks accounts, and X.25 provisioning.</p>
    <div class="grid">
      ${providerPanels}
      <section class="panel">
        <div class="label">Demo Field Operator Login</div>
        <p>Email: operator@camp.example</p>
        <p>Campsite: Camp Laminar</p>
        <p>Role: user</p>
      </section>
      <section class="panel">
        <div class="label">ShadyBucks</div>
        <p>Demo users receive a linked ShadyBucks account for food-service payments and ATM terminal settlement tests.</p>
      </section>
    </div>
    <pre>POST /api/session
{"email":"operator@camp.example","campsite":"Camp Laminar"}</pre>
  `);
}

function consolePage() {
  return operationalPage("Operational Console", `
    <h1>Operational Console</h1>
    <p>Configure PDF packet forms, request network provisioning, verify your X.121 Address, and test service verbs before camp opens.</p>
    <div class="grid">
      <section class="panel"><div class="label">PDF Configuration</div><p>Enable packet invoices, provisioning receipts, food-order chits, and ATM activation forms.</p></section>
      <section class="panel"><div class="label">Provisioning Verification</div><p>Calls the assigned service address and stores the terminal transcript.</p></section>
      <section class="panel"><div class="label">X.121 Address</div><p>Camp Laminar demo assignment: 311088020184.</p></section>
      <section class="panel"><div class="label">ShadyBucks Account</div><p>SB-CAMP-LAMINAR-001 is linked for demo settlement and order quotes.</p></section>
    </div>
    <pre>CALL 311088020501
CONNECT MILIWAYS ORDER ENTRY
MENU SERVICE=CAMP-LAMINAR</pre>
  `);
}

function adminPage() {
  return operationalPage("Admin Control Panel", `
    <h1>Admin Control Panel</h1>
    <p>Oversee service registry entries, user provisioning, PDF policies, X.121 allocations, ShadyBucks Settlement, and camp namespaces.</p>
    <div class="grid">
      <section class="panel"><div class="label">Service Registry</div><p>${serviceDefinitions.length} services define verbs, inputs, outputs, and X.121 addresses.</p></section>
      <section class="panel"><div class="label">ShadyBucks Settlement</div><p>${billingAccounts.length} demo billing accounts are available for camp operators and ATM terminals.</p></section>
      <section class="panel"><div class="label">Provisioning Queue</div><p>${provisioningQueue.length} pending network install request.</p></section>
    </div>
  `);
}

function nocPage() {
  return operationalPage("Network Operations Center", `
    <h1>Network Operations Center</h1>
    <p>Monitor X.25 Adapter status, Circuit State, service reachability, PAD transports, and degraded radio links.</p>
    <div class="grid">
      ${circuitState.map((circuit) => `<section class="panel"><div class="label">${circuit.x121}</div><p>${circuit.service}</p><p>Status: ${circuit.status}</p><p>Transport: ${circuit.transport}</p></section>`).join("")}
    </div>
  `);
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

function authSecret(env = {}) {
  return env.AUTH_SECRET || "omnidat-local-test-secret";
}

async function sessionResponse(request, env = {}) {
  if (request.method !== "POST") {
    const existingSession = await decodeSession(cookieValue(request, "omnidat_session"), authSecret(env));
    if (existingSession) {
      return json({
        status: "authenticated",
        user: existingSession.user,
      });
    }
    return json({
      status: "anonymous",
      sso: "OAuth SSO available",
      providers: authProviders.map((provider) => provider.id),
      demoLogin: "/login",
    });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Valid JSON request body required." }, 400);
  }

  const email = String(payload.email || "operator@camp.example").trim();
  const campsite = String(payload.campsite || "Camp Laminar").trim();

  return json({
    status: "created",
    user: {
      id: "usr_demo_operator",
      email,
      campsite,
      roles: ["user"],
      pdfProfile: {
        enabled: true,
        forms: ["provisioning-receipt", "food-order-chit", "atm-activation", "packet-invoice"],
        delivery: "download-and-print",
      },
      shadybucksAccount: {
        accountId: "SB-CAMP-LAMINAR-001",
        status: "linked-demo",
        provider: "ShadyBucks",
      },
    },
  }, 201);
}

function authProvidersResponse() {
  return json({
    service,
    defaultProvider: "omniauth",
    providers: authProviders,
  });
}

function authRedirect(request, providerId = "omniauth") {
  const provider = authProvider(providerId);
  if (!provider) {
    return json({ error: "unknown auth provider" }, 404);
  }
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/console";
  const state = btoa(`returnTo=${encodeURIComponent(returnTo)}`).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const authorize = new URL(provider.authorizationUrl);
  authorize.searchParams.set("client_id", provider.clientId);
  authorize.searchParams.set("redirect_uri", provider.callbackUrl);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", provider.scopes.join(" "));
  authorize.searchParams.set("state", state);
  return redirect(authorize.toString());
}

function decodeState(value) {
  try {
    const decoded = base64UrlDecode(value);
    return decoded.includes("returnTo=") ? decoded : value;
  } catch {
    return value;
  }
}

function demoIdentity(provider, code) {
  const admin = code === "demo-admin-code";
  const identities = {
    omniauth: {
      id: admin ? "usr_omniauth_admin" : "usr_omniauth_operator",
      email: admin ? "admin@omniauth.example" : "operator@omniauth.example",
      subject: admin ? "omniauth-demo-admin" : "omniauth-demo-operator",
    },
    forgegraph: {
      id: admin ? "usr_forgegraph_admin" : "usr_forgegraph_operator",
      email: admin ? "admin@forgegraf.com" : "operator@forgegraf.com",
      subject: admin ? "forgegraph-demo-admin" : "forgegraph-demo-operator",
    },
    github: {
      id: admin ? "usr_github_admin" : "usr_github_operator",
      email: admin ? "admin@github.example" : "operator@github.example",
      subject: admin ? "github-demo-admin" : "github-demo-operator",
    },
  };
  return identities[provider.id] || identities.omniauth;
}

async function authCallback(request, env = {}, providerId = "omniauth") {
  const provider = authProvider(providerId);
  if (!provider) {
    return json({ error: "unknown auth provider" }, 404);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return json({ error: `${provider.id} callback requires code` }, 400);
  }
  const state = decodeState(url.searchParams.get("state") || "");
  const returnTo = new URLSearchParams(state).get("returnTo") || "/console";
  const roles = code === "demo-admin-code" ? ["user", "noc", "admin"] : ["user", "noc"];
  const identity = demoIdentity(provider, code);
  const session = {
    user: {
      id: identity.id,
      email: identity.email,
      campsite: "Camp Laminar",
      roles,
      sso: {
        provider: provider.id,
        subject: identity.subject,
      },
      pdfProfile: {
        enabled: true,
        forms: ["provisioning-receipt", "food-order-chit", "atm-activation", "packet-invoice"],
        delivery: "download-and-print",
      },
      shadybucksAccount: {
        accountId: "SB-CAMP-LAMINAR-001",
        status: "linked-demo",
        provider: "ShadyBucks",
      },
    },
  };
  return redirect(returnTo, {
    "set-cookie": await sessionCookie(session, authSecret(env)),
  });
}

function servicesResponse() {
  return json({
    service,
    services: serviceDefinitions,
  });
}

async function networkResponse(env = {}) {
  if (env.X25_STATUS_URL) {
    try {
      const upstream = await fetch(env.X25_STATUS_URL, {
        headers: { accept: "application/json" },
      });
      if (upstream.ok) {
        const payload = await upstream.json();
        return json({
          service,
          network: {
            protocol: "X.25",
            status: payload.status || "unknown",
            source: "configured-x25-adapter",
            adapterUrl: env.X25_STATUS_URL,
          },
          directory: payload.directory || serviceDefinitions,
          services: payload.services || serviceDefinitions,
          circuits: payload.circuits || circuitState,
        });
      }
    } catch {
      // Fall through to the seeded adapter state so the control plane remains usable.
    }
  }

  return json({
    service,
    network: {
      protocol: "X.25",
      status: "operational",
      source: "seeded-exchange-88-adapter",
      adapterUrl: null,
    },
    directory: serviceDefinitions.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      x121: entry.x121,
      status: entry.status,
    })),
    services: serviceDefinitions,
    circuits: circuitState,
  });
}

async function provisioningResponse(request) {
  if (request.method !== "POST") {
    return json({
      queue: provisioningQueue,
      pdfProfile: "packet-provisioning-receipt",
    });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Valid JSON request body required." }, 400);
  }

  const campsiteName = String(payload.campsiteName || "Camp Laminar").trim();
  const serviceSlug = String(payload.serviceSlug || "directory").trim();
  const destination = serviceDefinitions.find((entry) => entry.slug === serviceSlug) || serviceDefinitions[0];
  const assignment = {
    campsiteName,
    x121: "311088020184",
    namespace: "camp",
    transport: String(payload.transport || "meshcore"),
  };

  return json({
    status: "verified",
    assignment,
    destination: {
      service: destination.name,
      x121: destination.x121,
    },
    transcript: `OMNIDAT PAD READY
CALL ${destination.x121}
CONNECT ${destination.name.toUpperCase()}
VERIFY ${assignment.x121}
STATUS VERIFIED`,
    pdfReceipt: {
      form: "provisioning-receipt",
      filename: "omnidat-provisioning-receipt.pdf",
      status: "ready",
    },
  }, 202);
}

function adminOverviewResponse() {
  return json({
    service,
    roles: ["admin", "noc", "user"],
    services: serviceDefinitions,
    billing: {
      provider: "ShadyBucks",
      accounts: billingAccounts,
    },
    provisioning: {
      pending: provisioningQueue,
      x121Pool: ["311088020184", "311088020185", "311088020186"],
    },
  });
}

function nocStatusResponse() {
  return json({
    service,
    center: "Exchange 88 Network Operations Center",
    adapter: {
      protocol: "X.25",
      source: "seeded-exchange-88-adapter",
      status: "operational",
    },
    circuits: circuitState,
  });
}

function billingAccountsResponse() {
  return json({
    service,
    provider: "ShadyBucks",
    accounts: billingAccounts,
  });
}

function pdfProfileResponse(request) {
  return json({
    service,
    status: request.method === "PATCH" ? "updated" : "ready",
    profile: {
      enabled: true,
      forms: ["provisioning-receipt", "food-order-chit", "atm-activation", "packet-invoice"],
      pageSize: "letter",
      tone: "fake-corporate",
    },
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
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" || url.pathname === "/api/health/live" || url.pathname === "/api/health/ready") {
      return health();
    }

    if (url.pathname === "/") {
      return homepage();
    }

    if (url.pathname === "/login") {
      return loginPage();
    }

    if (url.pathname === "/console") {
      return requirePageSession(request, env, ["user", "noc", "admin"], () => consolePage());
    }

    if (url.pathname === "/admin") {
      return requirePageSession(request, env, ["admin"], () => adminPage());
    }

    if (url.pathname === "/noc") {
      return requirePageSession(request, env, ["noc", "admin"], () => nocPage());
    }

    if (url.pathname === "/api/session") {
      return sessionResponse(request, env);
    }

    if (url.pathname === "/api/auth/providers") {
      return authProvidersResponse();
    }

    if (url.pathname.startsWith("/api/auth/callback/")) {
      const providerId = url.pathname.slice("/api/auth/callback/".length);
      return authCallback(request, env, providerId);
    }

    if (url.pathname.startsWith("/api/auth/")) {
      const providerId = url.pathname.slice("/api/auth/".length);
      return authRedirect(request, providerId);
    }

    if (url.pathname === "/api/network") {
      return networkResponse(env);
    }

    if (url.pathname === "/api/services") {
      return servicesResponse();
    }

    if (url.pathname === "/api/campsite-apps") {
      return campsiteApps();
    }

    if (url.pathname === "/api/business-examples") {
      return businessExampleResponse();
    }

    if (url.pathname === "/api/provisioning") {
      return provisioningResponse(request);
    }

    if (url.pathname === "/api/admin/overview") {
      return requireApiSession(request, env, ["admin"], () => adminOverviewResponse());
    }

    if (url.pathname === "/api/noc/status") {
      return requireApiSession(request, env, ["noc", "admin"], () => nocStatusResponse());
    }

    if (url.pathname === "/api/billing/accounts") {
      return requireApiSession(request, env, ["admin"], () => billingAccountsResponse());
    }

    if (url.pathname === "/api/pdf-profile") {
      return pdfProfileResponse(request);
    }

    if (url.pathname === "/api/protocols/food-service") {
      return json(foodProtocol);
    }

    if (url.pathname === "/api/protocols/shadybucks-atm") {
      return json(shadybucksAtmProtocol);
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
