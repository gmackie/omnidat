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
  assert.equal(body.service, "omnidat-field-office-edge");
  assert.equal(body.status, "healthy");
  assert.equal(body.hostname, "omnidat.gmac.io");
});

test("homepage presents the field office and network signup surface", async () => {
  const response = await fetchPath("/");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(html, /OMNIDAT Field Office/);
  assert.match(html, /Join the packet clearing network/);
  assert.match(html, /MeshCore \/ Meshtastic gateway/);
});

test("terminal directory endpoint returns campsite app entries", async () => {
  const response = await fetchPath("/radio?command=DIR");
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(text, /020184\s+CAMP LAMINAR MESSAGE DESK/);
  assert.match(text, /020501\s+MILIWAYS ORDER ENTRY/);
  assert.match(text, /030021\s+PASSPORT LOG ENTRY/);
});

test("unknown routes return a compact packet error page", async () => {
  const response = await fetchPath("/not-a-real-circuit");
  const text = await response.text();

  assert.equal(response.status, 404);
  assert.match(text, /NO CARRIER/);
});
