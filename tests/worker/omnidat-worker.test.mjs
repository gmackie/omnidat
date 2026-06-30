import assert from "node:assert/strict";
import test from "node:test";

import worker from "../../worker/omnidat-worker.mjs";

async function fetchPath(path) {
  return worker.fetch(new Request(`https://omnidat.gmac.io${path}`), {}, {});
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
