import assert from "node:assert/strict";
import test from "node:test";

import worker from "../../worker/omnidat-worker.mjs";

async function fetchPath(path) {
  return worker.fetch(new Request(`https://omnidat.gmac.io${path}`), {}, {});
}

async function fetchJson(path, init = {}) {
  const response = await worker.fetch(new Request(`https://omnidat.gmac.io${path}`, init), {}, {});
  return { response, body: await response.json() };
}

async function sessionCookie(
  code = "demo-omniauth-code",
  env = { AUTH_SECRET: "test-auth-secret" },
  provider = "omniauth",
  returnTo = "/console",
) {
  const state = await authState(provider, returnTo, env);
  const response = await worker.fetch(
    new Request(`https://omnidat.gmac.io/api/auth/callback/${provider}?code=${code}&state=${encodeURIComponent(state)}`),
    env,
    {},
  );
  return response.headers.get("set-cookie");
}

async function authState(provider = "omniauth", returnTo = "/console", env = { AUTH_SECRET: "test-auth-secret" }) {
  const response = await worker.fetch(
    new Request(`https://omnidat.gmac.io/api/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`),
    env,
    {},
  );
  return new URL(response.headers.get("location")).searchParams.get("state");
}

async function authCallback(provider, code, returnTo, env = { AUTH_SECRET: "test-auth-secret" }) {
  const state = await authState(provider, returnTo, env);
  return worker.fetch(
    new Request(`https://omnidat.gmac.io/api/auth/callback/${provider}?code=${code}&state=${encodeURIComponent(state)}`),
    env,
    {},
  );
}

async function fetchPathWithCookie(path, cookie, env = { AUTH_SECRET: "test-auth-secret" }) {
  return worker.fetch(new Request(`https://omnidat.gmac.io${path}`, {
    headers: { cookie },
  }), env, {});
}

async function fetchJsonWithCookie(path, cookie, env = { AUTH_SECRET: "test-auth-secret" }) {
  const response = await fetchPathWithCookie(path, cookie, env);
  return { response, body: await response.json() };
}

test("health endpoint reports the OMNIDAT edge service as healthy", async () => {
  const response = await fetchPath("/api/health");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.service, "omnidat-v1-worker");
  assert.equal(body.status, "healthy");
  assert.equal(body.hostname, "omnidat.gmac.io");
  assert.equal(body.transport, "cloudflare-worker");
  assert.equal(body.database, "postgres-shared-fryos-v1");
  assert.equal(body.schema, "omnidat");
});

test("homepage presents the field office and network signup surface", async () => {
  const response = await fetchPath("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(html, /OMNIDAT Field Office/);
  assert.match(html, /Join the packet clearing network/);
  assert.match(html, /MeshCore \/ Meshtastic gateway/);
  assert.match(html, /Exchange 88 v1 edge office/);
  assert.doesNotMatch(html, /provisional/i);
});

test("homepage emphasizes the X.25 business innovation network", async () => {
  const response = await fetchPath("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /X\.25 Packet Clearing Network/);
  assert.match(html, /The Future of Business Innovation/);
  assert.match(html, /Packet Utility Commission/);
  assert.match(html, /Executive Circuit Provisioning/);
  assert.match(html, /Department of Recreational Commerce/);
});

test("homepage links business language to haha.business", async () => {
  const response = await fetchPath("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /href="https:\/\/haha\.business\/"[^>]*>The Future of Business Innovation<\/a>/);
  assert.match(html, /href="https:\/\/haha\.business\/"[^>]*>business<\/a>/i);
});

test("homepage wraps terminal examples in preformatted blocks", async () => {
  const response = await fetchPath("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.ok((html.match(/<pre/g) || []).length >= 4);
  assert.match(html, /CALL 010110[\s\S]*CONNECT PACKET CLEARING DIRECTORY/);
  assert.match(html, /OPEN CAMP\.MILIWAYS[\s\S]*ORDER STATUS: RECEIVED/);
  assert.match(html, /SUBMIT PASSPORT\.LOG[\s\S]*STAMP: FILED/);
  assert.match(html, /CREATE APP CAMP\.SUNDIAL[\s\S]*CIRCUIT REQUEST: QUEUED/);
});

test("business examples endpoint returns fake corporate network use cases", async () => {
  const response = await fetchPath("/api/business-examples");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.service, "omnidat-v1-worker");
  assert.ok(body.examples.some((example) => example.slug === "miliways-line-management"));
  assert.ok(body.examples.some((example) => example.slug === "activity-passport"));
  assert.ok(body.examples.some((example) => example.slug === "camp-app-exchange"));
});

test("operational console exposes login and user provisioning surfaces", async () => {
  const login = await fetchPath("/login");
  const loginHtml = await login.text();
  const cookie = await sessionCookie();
  const consolePage = await fetchPathWithCookie("/console", cookie);
  const consoleHtml = await consolePage.text();

  assert.equal(login.status, 200);
  assert.match(loginHtml, /OmniAuth Passkey/);
  assert.match(loginHtml, /ForgeGraph OAuth/);
  assert.match(loginHtml, /GitHub OAuth/);
  assert.match(loginHtml, /Demo Field Operator Login/);
  assert.match(loginHtml, /ShadyBucks/);
  assert.equal(consolePage.status, 200);
  assert.match(consoleHtml, /PDF Configuration/);
  assert.match(consoleHtml, /Provisioning Verification/);
  assert.match(consoleHtml, /X\.121 Address/);
});

test("operational pages require signed sessions and roles", async () => {
  const consolePage = await fetchPath("/console");
  const nocPage = await fetchPath("/noc");
  const adminPage = await fetchPath("/admin");
  const operatorAdminPage = await fetchPath("/operator-admin");

  assert.equal(consolePage.status, 302);
  assert.equal(consolePage.headers.get("location"), "/login?returnTo=%2Fconsole");
  assert.equal(nocPage.status, 302);
  assert.equal(nocPage.headers.get("location"), "/login?returnTo=%2Fnoc");
  assert.equal(adminPage.status, 302);
  assert.equal(adminPage.headers.get("location"), "/login?returnTo=%2Fadmin");
  assert.equal(operatorAdminPage.status, 302);
  assert.equal(
    operatorAdminPage.headers.get("location"),
    "/login?returnTo=%2Foperator-admin",
  );

  const nocCookie = await sessionCookie();
  const adminAsNoc = await fetchPathWithCookie("/admin", nocCookie);
  assert.equal(adminAsNoc.status, 403);
  assert.match(await adminAsNoc.text(), /INSUFFICIENT CLEARANCE/);

  const adminCookie = await sessionCookie("demo-admin-code");
  const admin = await fetchPathWithCookie("/admin", adminCookie);
  const operatorAdmin = await fetchPathWithCookie(
    "/operator-admin",
    adminCookie,
  );
  assert.equal(admin.status, 200);
  assert.equal(operatorAdmin.status, 200);
  assert.match(await admin.text(), /Admin Control Panel/);
  assert.match(await operatorAdmin.text(), /Admin Control Panel/);
});

test("session endpoint returns demo user, roles, PDFs, and ShadyBucks account", async () => {
  const { response, body } = await fetchJson("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "operator@camp.example", campsite: "Camp Laminar" }),
  });

  assert.equal(response.status, 201);
  assert.equal(body.user.email, "operator@camp.example");
  assert.deepEqual(body.user.roles, ["user"]);
  assert.equal(body.user.pdfProfile.enabled, true);
  assert.equal(body.user.shadybucksAccount.status, "linked-demo");
  assert.match(body.user.shadybucksAccount.accountId, /^SB-/);
});

test("auth provider metadata exposes OmniAuth, ForgeGraph, and GitHub SSO", async () => {
  const { response, body } = await fetchJson("/api/auth/providers");

  assert.equal(response.status, 200);
  assert.equal(body.defaultProvider, "omniauth");
  assert.deepEqual(body.providers.map((provider) => provider.id), ["omniauth", "forgegraph", "github"]);
  assert.equal(body.providers[0].protocol, "oauth-passkey");
  assert.equal(body.providers[0].authorizationUrl, "https://omniauth.gmac.io/oauth/authorize");
  assert.equal(body.providers[0].callbackUrl, "https://omnidat.gmac.io/api/auth/callback/omniauth");
  assert.equal(body.providers[1].authorizationUrl, "https://forgegraf.com/api/auth/oauth2/authorize");
  assert.equal(body.providers[1].callbackUrl, "https://omnidat.gmac.io/api/auth/callback/forgegraph");
  assert.equal(body.providers[2].authorizationUrl, "https://github.com/login/oauth/authorize");
  assert.equal(body.providers[2].callbackUrl, "https://omnidat.gmac.io/api/auth/callback/github");
});

test("auth login redirects to OmniAuth passkey, ForgeGraph, and GitHub providers", async () => {
  const response = await fetchPath("/api/auth/omniauth?returnTo=/console");
  const forgegraph = await fetchPath("/api/auth/forgegraph?returnTo=/noc");
  const github = await fetchPath("/api/auth/github?returnTo=/console");
  const omniauthLocation = response.headers.get("location");
  const forgegraphLocation = forgegraph.headers.get("location");
  const githubLocation = github.headers.get("location");

  assert.equal(response.status, 302);
  assert.match(omniauthLocation, /^https:\/\/omniauth\.gmac\.io\/oauth\/authorize\?/);
  assert.match(omniauthLocation, /client_id=omnidat-field-office/);
  assert.match(omniauthLocation, /redirect_uri=https%3A%2F%2Fomnidat\.gmac\.io%2Fapi%2Fauth%2Fcallback%2Fomniauth/);
  assert.match(omniauthLocation, /scope=openid\+profile\+email\+passkey\+shadybucks/);
  assert.match(omniauthLocation, /state=/);
  assert.match(new URL(omniauthLocation).searchParams.get("state"), /^[^.]+\.[^.]+$/);
  assert.equal(forgegraph.status, 302);
  assert.match(forgegraphLocation, /^https:\/\/forgegraf\.com\/api\/auth\/oauth2\/authorize\?/);
  assert.match(forgegraphLocation, /client_id=omnidat-field-office/);
  assert.match(forgegraphLocation, /redirect_uri=https%3A%2F%2Fomnidat\.gmac\.io%2Fapi%2Fauth%2Fcallback%2Fforgegraph/);
  assert.equal(github.status, 302);
  assert.match(githubLocation, /^https:\/\/github\.com\/login\/oauth\/authorize\?/);
  assert.match(githubLocation, /client_id=omnidat-field-office/);
  assert.match(githubLocation, /redirect_uri=https%3A%2F%2Fomnidat\.gmac\.io%2Fapi%2Fauth%2Fcallback%2Fgithub/);
});

test("auth callbacks issue provider-specific session cookies", async () => {
  const env = { AUTH_SECRET: "test-auth-secret" };
  const callback = await authCallback("omniauth", "demo-omniauth-code", "/console", env);
  const forgegraphCallback = await authCallback("forgegraph", "demo-forgegraph-code", "/noc", env);
  const githubCallback = await authCallback("github", "demo-github-code", "/console", env);
  const cookie = callback.headers.get("set-cookie");
  const forgegraphCookie = forgegraphCallback.headers.get("set-cookie");
  const githubCookie = githubCallback.headers.get("set-cookie");

  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/console");
  assert.equal(forgegraphCallback.status, 302);
  assert.equal(forgegraphCallback.headers.get("location"), "/noc");
  assert.equal(githubCallback.status, 302);
  assert.equal(githubCallback.headers.get("location"), "/console");
  assert.match(cookie, /omnidat_session=/);
  assert.match(forgegraphCookie, /omnidat_session=/);
  assert.match(githubCookie, /omnidat_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  const session = await worker.fetch(new Request("https://omnidat.gmac.io/api/session", {
    headers: { cookie },
  }), env, {});
  const body = await session.json();
  const forgegraphSession = await worker.fetch(new Request("https://omnidat.gmac.io/api/session", {
    headers: { cookie: forgegraphCookie },
  }), env, {});
  const forgegraphBody = await forgegraphSession.json();
  const githubSession = await worker.fetch(new Request("https://omnidat.gmac.io/api/session", {
    headers: { cookie: githubCookie },
  }), env, {});
  const githubBody = await githubSession.json();

  assert.equal(session.status, 200);
  assert.equal(body.status, "authenticated");
  assert.equal(body.user.email, "operator@omniauth.example");
  assert.deepEqual(body.user.roles, ["user", "noc"]);
  assert.equal(body.user.sso.provider, "omniauth");
  assert.equal(forgegraphBody.user.email, "operator@forgegraf.com");
  assert.equal(forgegraphBody.user.sso.provider, "forgegraph");
  assert.equal(githubBody.user.email, "operator@github.example");
  assert.equal(githubBody.user.sso.provider, "github");
});

test("session endpoint rejects tampered omniauth cookies", async () => {
  const env = { AUTH_SECRET: "test-auth-secret" };
  const callback = await authCallback("omniauth", "demo-omniauth-code", "/console", env);
  const cookie = callback.headers.get("set-cookie").replace(/omnidat_session=([^;.]+)(.)/, "omnidat_session=$1x");
  const session = await worker.fetch(new Request("https://omnidat.gmac.io/api/session", {
    headers: { cookie },
  }), env, {});
  const body = await session.json();

  assert.equal(session.status, 200);
  assert.equal(body.status, "anonymous");
  assert.equal(body.sso, "OAuth SSO available");
});

test("auth callback rejects tampered OAuth state", async () => {
  const env = { AUTH_SECRET: "test-auth-secret" };
  const state = await authState("forgegraph", "/noc", env);
  const tamperedState = state.replace(/.$/, (last) => (last === "x" ? "y" : "x"));
  const callback = await worker.fetch(
    new Request(`https://omnidat.gmac.io/api/auth/callback/forgegraph?code=demo-forgegraph-code&state=${encodeURIComponent(tamperedState)}`),
    env,
    {},
  );
  const body = await callback.json();

  assert.equal(callback.status, 400);
  assert.equal(body.error, "invalid oauth state");
});

test("auth callback constrains returnTo to local paths", async () => {
  const env = { AUTH_SECRET: "test-auth-secret" };
  const callback = await authCallback("github", "demo-github-code", "https://evil.example/steal", env);
  const protocolRelativeCallback = await authCallback("omniauth", "demo-omniauth-code", "//evil.example/steal", env);

  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/console");
  assert.equal(protocolRelativeCallback.status, 302);
  assert.equal(protocolRelativeCallback.headers.get("location"), "/console");
});

test("network status reports X.25 source, directory, and live service reachability", async () => {
  const { response, body } = await fetchJson("/api/network");

  assert.equal(response.status, 200);
  assert.equal(body.network.protocol, "X.25");
  assert.equal(body.network.status, "operational");
  assert.equal(body.network.source, "seeded-exchange-88-adapter");
  assert.ok(body.directory.some((entry) => entry.x121 === "311088020501"));
  assert.ok(body.services.some((entry) => entry.slug === "shadybucks-atm" && entry.reachable === true));
});

test("weekend simulation API exposes camp-scale dashboard metrics", async () => {
  const { response, body } = await fetchJson("/api/weekend-simulation");

  assert.equal(response.status, 200);
  assert.equal(body.scenario, "omnidat-full-camp-weekend");
  assert.equal(body.status, "running");
  assert.equal(body.campers.count, 1000);
  assert.equal(body.currency.primary, "OmniBucks");
  assert.equal(body.identity.uniqueSubjects, 1000);
  assert.equal(body.nightMarket.sales, 1000);
  assert.equal(body.miliways.orders, 1600);
  assert.equal(body.forms.totalFiled, 340);
  assert.equal(body.terminals.totalSessions, 312);
  assert.equal(body.x121.verified, 12);
  assert.equal(body.evidence.eventLog.events, 5888);
  assert.equal(body.evidence.eventLog.url, "/api/weekend-simulation/weekend-events.jsonl");
  assert.equal(body.evidence.bankLedger.events, 2000);
  assert.equal(body.evidence.bankLedger.url, "/api/weekend-simulation/weekend-bank-ledger.jsonl");
  assert.equal(body.evidence.queueOrders.records, 1600);
  assert.equal(body.evidence.queueOrders.url, "/api/weekend-simulation/miliways-queue/orders.json");
  assert.equal(body.evidence.networkFeeLedger.records, 1544);
  assert.equal(body.evidence.networkFeeLedger.url, "/api/weekend-simulation/weekend-network-fees.jsonl");
  assert.equal(body.networkFees.totalAssessed, "181.86");
  assert.equal(body.networkFees.byMode.percentage.records, 1000);
  assert.equal(body.networkFees.byMode["per-message"].records, 312);
  assert.equal(body.networkFees.statements.count, 7);
  assert.equal(body.networkFees.statements.totalAssessed, "181.86");
  assert.equal(body.networkFees.statements.byAccount[0].accountId, "OMNI-NIGHTMARKT");
  assert.equal(body.networkFees.statements.byAccount[0].networkFees, "17.50");
  assert.equal(body.networkFees.statements.byAccount[0].artifact, "billing-statements/OMNI-NIGHTMARKT.txt");
  assert.equal(body.networkFees.statements.byAccount[0].url, "/api/weekend-simulation/billing-statements/OMNI-NIGHTMARKT.txt");
  assert.equal(body.evidence.billingStatements.records, 7);
  assert.equal(body.samples.forms[0].formType, "campsite-provisioning");
  assert.equal(body.samples.terminalSessions[0].program, "OMNISALE.TCL");
  assert.equal(body.samples.merchantSetups[0].settlementCurrency, "OmniBucks");
  assert.ok(body.timeline.some((entry) => entry.label === "Night Market Friday"));
  // Sim field kit journal (H-slice): every op journaled and synced.
  assert.equal(body.journal.sourceId, "sim-field-kit");
  assert.equal(body.journal.total, 9432);
  assert.equal(body.journal.authority, "field");
});

test("weekend dashboard renders visual operations board", async () => {
  const response = await fetchPath("/dashboard");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Camp Weekend Operations Dashboard/);
  assert.match(html, /1000/);
  assert.match(html, /OmniBucks/);
  assert.match(html, /Night Market Friday/);
  assert.match(html, /Forms Filed/);
  assert.match(html, /Terminal Sessions/);
  assert.match(html, /X\.121 Provisioning/);
  assert.match(html, /Sim Field Kit Journal/);
  assert.match(html, /9432/);
  assert.match(html, /OMNISALE\.TCL/);
  assert.match(html, /Evidence Files/);
  assert.match(html, /href="\/api\/weekend-simulation\/weekend-events\.jsonl"/);
  assert.match(html, /href="\/api\/weekend-simulation\/weekend-bank-ledger\.jsonl"/);
  assert.match(html, /href="\/api\/weekend-simulation\/miliways-queue\/orders\.json"/);
  assert.match(html, /Network Fee Ledger/);
  assert.match(html, /href="\/api\/weekend-simulation\/weekend-network-fees\.jsonl"/);
  assert.match(html, /181\.86/);
  assert.match(html, /Billing Statements/);
  assert.match(html, /billing-statements\/OMNI-NIGHTMARKT\.txt/);
  assert.match(html, /href="\/api\/weekend-simulation\/billing-statements\/OMNI-NIGHTMARKT\.txt"/);
  assert.match(html, /OMNIDAT-CAMPSITE-BUREAU/);
  assert.match(html, /Merchant Accounts/);
  assert.match(html, /Form Inbox/);
  assert.match(html, /Recent Terminal Evidence/);
  assert.match(html, /class="bar"/);
});

test("weekend billing statement artifacts are downloadable text records", async () => {
  const response = await fetchPath("/api/weekend-simulation/billing-statements/OMNI-NIGHTMARKT.txt");
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.match(text, /OMNIDAT NETWORK FEE STATEMENT/);
  assert.match(text, /ACCOUNT OMNI-NIGHTMARKT/);
  assert.match(text, /NETWORK FEES 17\.50 OmniBucks/);
});

test("weekend billing statement artifacts reject unknown accounts", async () => {
  const response = await fetchPath("/api/weekend-simulation/billing-statements/UNKNOWN.txt");
  const text = await response.text();

  assert.equal(response.status, 404);
  assert.match(text, /NO CARRIER/);
});

test("weekend network fee ledger is downloadable JSONL evidence", async () => {
  const response = await fetchPath("/api/weekend-simulation/weekend-network-fees.jsonl");
  const text = await response.text();
  const lines = text.trim().split("\n").map((line) => JSON.parse(line));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
  assert.equal(lines.length, 1544);
  assert.equal(lines[0].type, "network_fee.assessed");
  assert.equal(lines[0].payload.policyId, "NF-POS-PERCENT");
  assert.equal(lines[0].payload.status, "assessed");
  assert.equal(lines.at(-1).payload.policyId, "NF-PUBLIC-WAIVER");
  assert.equal(lines.at(-1).payload.status, "waived");
});

test("weekend bank ledger is downloadable JSONL evidence", async () => {
  const response = await fetchPath("/api/weekend-simulation/weekend-bank-ledger.jsonl");
  const text = await response.text();
  const lines = text.trim().split("\n").map((line) => JSON.parse(line));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
  assert.equal(lines.length, 2000);
  assert.equal(lines[0].type, "omnibank.authorized");
  assert.equal(lines[0].payload.rail, "OMNIBANK_OMNIBUCKS_LEDGER");
  assert.equal(lines[0].payload.merchantId, "OMNI-NIGHTMARKT");
  assert.equal(lines[0].payload.amount, "7.00");
  assert.equal(lines[1].type, "omnibank.captured");
  assert.equal(lines[1].payload.authCode, lines[0].payload.authCode);
  assert.equal(lines.at(-1).type, "omnibank.captured");
  assert.equal(lines.at(-1).payload.responseCode, "00");
});

test("weekend event log is downloadable JSONL evidence", async () => {
  const response = await fetchPath("/api/weekend-simulation/weekend-events.jsonl");
  const text = await response.text();
  const lines = text.trim().split("\n").map((line) => JSON.parse(line));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
  assert.equal(lines.length, 5888);
  assert.equal(lines[0].type, "omnibucks.seeded");
  assert.equal(lines[0].payload.camperId, "CAMPER-0001");
  assert.equal(lines[0].payload.amount, "80.00");
  assert.ok(lines.some((line) => line.type === "x121.provisioned" && line.payload.x121 === "311088020601"));
  assert.ok(lines.some((line) => line.type === "terminal.session" && line.payload.program === "OMNISALE.TCL"));
  assert.equal(lines.at(-1).type, "event.audit.padding");
});

test("weekend Miliways queue orders are downloadable JSON evidence", async () => {
  const response = await fetchPath("/api/weekend-simulation/miliways-queue/orders.json");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(body.orders.length, 1600);
  assert.equal(body.orders[0].ticketId, "MLY-000001");
  assert.equal(body.orders[0].queueId, "miliways");
  assert.equal(body.orders[0].serviceAddress, "020501");
  assert.equal(body.orders[0].itemId, "tea");
  assert.equal(body.orders[0].status, "accepted");
  assert.equal(body.orders.at(-1).ticketId, "MLY-001600");
  assert.equal(body.summary.records, 1600);
  assert.deepEqual(body.summary.serviceWindows, ["friday-dinner", "saturday-breakfast", "saturday-dinner", "sunday-breakfast"]);
});

test("services define verbs inputs outputs and X.121 addresses", async () => {
  const { response, body } = await fetchJson("/api/services");

  assert.equal(response.status, 200);
  const food = body.services.find((entry) => entry.slug === "food-service");
  const atm = body.services.find((entry) => entry.slug === "shadybucks-atm");

  assert.equal(food.x121, "311088020501");
  assert.ok(food.verbs.some((verb) => verb.name === "MENU" && verb.inputs.includes("serviceId")));
  assert.ok(food.verbs.some((verb) => verb.name === "QUOTE" && verb.outputs.includes("total")));
  assert.equal(atm.x121, "311088030100");
  assert.ok(atm.verbs.some((verb) => verb.name === "ATM.SETUP" && verb.inputs.includes("terminalId")));
  assert.ok(atm.verbs.some((verb) => verb.name === "WITHDRAW" && verb.outputs.includes("receiptId")));
});

test("provisioning verification returns a network transcript", async () => {
  const { response, body } = await fetchJson("/api/provisioning", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      campsiteName: "Camp Laminar",
      serviceSlug: "food-service",
      transport: "meshcore",
    }),
  });

  assert.equal(response.status, 202);
  assert.equal(body.status, "verified");
  assert.equal(body.assignment.x121, "311088020184");
  assert.match(body.transcript, /CALL 311088020501/);
  assert.match(body.transcript, /CONNECT MILIWAYS ORDER ENTRY/);
});

test("admin and NOC APIs expose billing, provisioning, and circuit state", async () => {
  const adminCookie = await sessionCookie("demo-admin-code");
  const nocCookie = await sessionCookie();
  const admin = await fetchJsonWithCookie("/api/admin/overview", adminCookie);
  const noc = await fetchJsonWithCookie("/api/noc/status", nocCookie);
  const billing = await fetchJsonWithCookie("/api/billing/accounts", adminCookie);

  assert.equal(admin.response.status, 200);
  assert.ok(admin.body.billing.accounts.some((account) => account.provider === "ShadyBucks"));
  assert.ok(admin.body.provisioning.pending.some((request) => request.campsiteName === "Camp Laminar"));
  assert.equal(noc.response.status, 200);
  assert.ok(noc.body.circuits.some((circuit) => circuit.x121 === "311088030100" && circuit.status === "up"));
  assert.equal(noc.body.weekendOperations.scenario, "omnidat-full-camp-weekend");
  assert.equal(noc.body.weekendOperations.evidence.eventLog.events, 5888);
  assert.equal(noc.body.terminalHealth.totalSessions, 312);
  assert.ok(noc.body.incidentQueue.some((incident) => incident.kind === "radio-degradation" && incident.status === "watching"));
  assert.equal(billing.response.status, 200);
  assert.ok(billing.body.accounts.some((account) => account.type === "atm-settlement"));
  assert.ok(billing.body.feePolicies.some((policy) => policy.mode === "per-message" && policy.appliesTo.includes("x25-pad")));
  assert.ok(billing.body.feePolicies.some((policy) => policy.mode === "percentage" && policy.appliesTo.includes("pos-sale")));
});

test("privileged APIs reject missing or insufficient roles", async () => {
  const anonymousAdmin = await fetchJson("/api/admin/overview");
  const anonymousNoc = await fetchJson("/api/noc/status");
  const nocCookie = await sessionCookie();
  const nocBilling = await fetchJsonWithCookie("/api/billing/accounts", nocCookie);

  assert.equal(anonymousAdmin.response.status, 401);
  assert.equal(anonymousAdmin.body.error, "authentication required");
  assert.equal(anonymousNoc.response.status, 401);
  assert.equal(anonymousNoc.body.error, "authentication required");
  assert.equal(nocBilling.response.status, 403);
  assert.equal(nocBilling.body.error, "insufficient clearance");
});

test("food service and ShadyBucks ATM protocol endpoints are configurable", async () => {
  const food = await fetchJson("/api/protocols/food-service");
  const atm = await fetchJson("/api/protocols/shadybucks-atm");

  assert.equal(food.response.status, 200);
  assert.ok(food.body.menu.some((item) => item.priceShadyBucks === 7));
  assert.ok(food.body.waitLines.some((line) => line.status === "accepting-orders"));
  assert.ok(food.body.verbs.some((verb) => verb.name === "ORDER.CREATE"));
  assert.equal(atm.response.status, 200);
  assert.ok(atm.body.setupChecklist.includes("Assign X.121 terminal address"));
  assert.ok(atm.body.verbs.some((verb) => verb.name === "ATM.SETUP"));
});

test("admin and NOC pages render operational controls", async () => {
  const adminCookie = await sessionCookie("demo-admin-code");
  const nocCookie = await sessionCookie();
  const admin = await fetchPathWithCookie("/admin", adminCookie);
  const adminHtml = await admin.text();
  const noc = await fetchPathWithCookie("/noc", nocCookie);
  const nocHtml = await noc.text();

  assert.equal(admin.status, 200);
  assert.match(adminHtml, /Admin Control Panel/);
  assert.match(adminHtml, /Service Registry/);
  assert.match(adminHtml, /ShadyBucks Settlement/);
  assert.match(adminHtml, /Network Fee Policies/);
  assert.equal(noc.status, 200);
  assert.match(nocHtml, /Network Operations Center/);
  assert.match(nocHtml, /Circuit State/);
  assert.match(nocHtml, /X\.25 Adapter/);
  assert.match(nocHtml, /Weekend Operations/);
  assert.match(nocHtml, /Incident Queue/);
  assert.match(nocHtml, /Terminal Health/);
  assert.match(nocHtml, /5888 events/);
});

test("terminal directory endpoint returns campsite app entries", async () => {
  const response = await fetchPath("/radio?command=DIR");
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(text, /020184\s+CAMP LAMINAR MESSAGE DESK/);
  assert.match(text, /020501\s+MILIWAYS ORDER ENTRY/);
  assert.match(text, /030021\s+PASSPORT LOG ENTRY/);
});

test("campsite apps endpoint returns packet app metadata", async () => {
  const response = await fetchPath("/api/campsite-apps");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.service, "omnidat-v1-worker");
  assert.equal(body.namespace, "camp");
  assert.ok(body.apps.some((app) => app.circuit === "020501" && app.slug === "miliways"));
  assert.ok(body.apps.some((app) => app.circuit === "030021" && app.slug === "passport"));
});

test("signup endpoint queues campsite circuit requests", async () => {
  const response = await worker.fetch(new Request("https://omnidat.gmac.io/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      campsiteName: "Camp Laminar",
      contact: "operator@example.test",
      namespace: "camp",
      transport: "meshcore",
    }),
  }), {}, {});
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.status, "queued");
  assert.equal(body.service, "omnidat-v1-worker");
  assert.equal(body.request.campsiteName, "Camp Laminar");
  assert.equal(body.request.namespace, "camp");
  assert.equal(body.request.transport, "meshcore");
});

test("signup endpoint rejects incomplete campsite requests", async () => {
  const response = await worker.fetch(new Request("https://omnidat.gmac.io/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ campsiteName: "Camp Laminar" }),
  }), {}, {});
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.status, "rejected");
  assert.match(body.error, /contact/i);
});

test("unknown routes return a compact packet error page", async () => {
  const response = await fetchPath("/not-a-real-circuit");
  const text = await response.text();

  assert.equal(response.status, 404);
  assert.match(text, /NO CARRIER/);
});
