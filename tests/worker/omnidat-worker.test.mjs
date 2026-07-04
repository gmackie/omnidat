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
  const consolePage = await fetchPath("/console");
  const consoleHtml = await consolePage.text();

  assert.equal(login.status, 200);
  assert.match(loginHtml, /ShadyTel SSO/);
  assert.match(loginHtml, /Demo Field Operator Login/);
  assert.match(loginHtml, /ShadyBucks/);
  assert.equal(consolePage.status, 200);
  assert.match(consoleHtml, /PDF Configuration/);
  assert.match(consoleHtml, /Provisioning Verification/);
  assert.match(consoleHtml, /X\.121 Address/);
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

test("omniauth provider metadata exposes ShadyTel shared services SSO", async () => {
  const { response, body } = await fetchJson("/api/auth/providers");

  assert.equal(response.status, 200);
  assert.equal(body.defaultProvider, "shadytel-omniauth");
  assert.equal(body.providers[0].id, "shadytel-omniauth");
  assert.equal(body.providers[0].protocol, "omniauth");
  assert.equal(body.providers[0].authorizationUrl, "https://identification.shady.tel/oauth/authorize");
  assert.equal(body.providers[0].callbackUrl, "https://omnidat.gmac.io/api/auth/callback/omniauth");
});

test("omniauth login redirects to ShadyTel with callback and state", async () => {
  const response = await fetchPath("/api/auth/omniauth?returnTo=/console");
  const location = response.headers.get("location");

  assert.equal(response.status, 302);
  assert.match(location, /^https:\/\/identification\.shady\.tel\/oauth\/authorize\?/);
  assert.match(location, /client_id=omnidat-field-office/);
  assert.match(location, /redirect_uri=https%3A%2F%2Fomnidat\.gmac\.io%2Fapi%2Fauth%2Fcallback%2Fomniauth/);
  assert.match(location, /scope=openid\+profile\+email\+shadybucks/);
  assert.match(location, /state=/);
});

test("omniauth callback issues session cookie and session endpoint reads it", async () => {
  const env = { AUTH_SECRET: "test-auth-secret" };
  const callback = await worker.fetch(
    new Request("https://omnidat.gmac.io/api/auth/callback/omniauth?code=demo-shadytel-code&state=returnTo%3D%252Fconsole"),
    env,
    {},
  );
  const cookie = callback.headers.get("set-cookie");

  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/console");
  assert.match(cookie, /omnidat_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);

  const session = await worker.fetch(new Request("https://omnidat.gmac.io/api/session", {
    headers: { cookie },
  }), env, {});
  const body = await session.json();

  assert.equal(session.status, 200);
  assert.equal(body.status, "authenticated");
  assert.equal(body.user.email, "operator@shadytel.example");
  assert.deepEqual(body.user.roles, ["user", "noc"]);
  assert.equal(body.user.sso.provider, "shadytel-omniauth");
});

test("session endpoint rejects tampered omniauth cookies", async () => {
  const env = { AUTH_SECRET: "test-auth-secret" };
  const callback = await worker.fetch(
    new Request("https://omnidat.gmac.io/api/auth/callback/omniauth?code=demo-shadytel-code&state=returnTo%3D%252Fconsole"),
    env,
    {},
  );
  const cookie = callback.headers.get("set-cookie").replace(/omnidat_session=([^;.]+)(.)/, "omnidat_session=$1x");
  const session = await worker.fetch(new Request("https://omnidat.gmac.io/api/session", {
    headers: { cookie },
  }), env, {});
  const body = await session.json();

  assert.equal(session.status, 200);
  assert.equal(body.status, "anonymous");
  assert.equal(body.sso, "ShadyTel SSO available");
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
  const admin = await fetchJson("/api/admin/overview");
  const noc = await fetchJson("/api/noc/status");
  const billing = await fetchJson("/api/billing/accounts");

  assert.equal(admin.response.status, 200);
  assert.ok(admin.body.billing.accounts.some((account) => account.provider === "ShadyBucks"));
  assert.ok(admin.body.provisioning.pending.some((request) => request.campsiteName === "Camp Laminar"));
  assert.equal(noc.response.status, 200);
  assert.ok(noc.body.circuits.some((circuit) => circuit.x121 === "311088030100" && circuit.status === "up"));
  assert.equal(billing.response.status, 200);
  assert.ok(billing.body.accounts.some((account) => account.type === "atm-settlement"));
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
  const admin = await fetchPath("/admin");
  const adminHtml = await admin.text();
  const noc = await fetchPath("/noc");
  const nocHtml = await noc.text();

  assert.equal(admin.status, 200);
  assert.match(adminHtml, /Admin Control Panel/);
  assert.match(adminHtml, /Service Registry/);
  assert.match(adminHtml, /ShadyBucks Settlement/);
  assert.equal(noc.status, 200);
  assert.match(nocHtml, /Network Operations Center/);
  assert.match(nocHtml, /Circuit State/);
  assert.match(nocHtml, /X\.25 Adapter/);
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
