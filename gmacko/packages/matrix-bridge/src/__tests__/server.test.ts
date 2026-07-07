import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBridgeServer } from "../server.js";
import { BridgeStore } from "../store.js";

let base: string;
let close: () => Promise<void>;

async function start(secret = "s3cret") {
  const store = new BridgeStore({ now: () => new Date("2026-07-07T09:30:00").getTime() });
  const server = createBridgeServer({ secret, store });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
  close = () =>
    new Promise((r) => server.close(() => r()));
}

function call(path: string, init: RequestInit = {}, secret = "s3cret") {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { "x-omnidat-secret": secret, "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test JSON is dynamic
async function body(res: Response): Promise<any> {
  return res.json();
}

describe("bridge server", () => {
  beforeEach(() => start());
  afterEach(() => close());

  it("rejects a wrong shared secret with 401", async () => {
    const res = await call("/dm/mailbox/042713", {}, "wrong");
    expect(res.status).toBe(401);
  });

  it("round-trips a DM: send → mailbox → read", async () => {
    const send = await call("/dm/send", {
      method: "POST",
      body: JSON.stringify({ from: "041027", to: "042713", body: "HI" }),
    });
    expect(send.status).toBe(200);
    const receipt = await body(send);
    expect(receipt.rcpt).toMatch(/^MSG-\d{5}$/u);

    const box = await body(await call("/dm/mailbox/042713"));
    expect(box.items[0]).toMatchObject({ no: 1, from: "041027", body: "HI" });

    await call("/dm/read", { method: "POST", body: JSON.stringify({ addr: "042713" }) });
    const after = await body(await call("/dm/mailbox/042713"));
    expect(after.items).toHaveLength(0);
  });

  it("round-trips a board post and page", async () => {
    const post = await call("/board/GEN/post", {
      method: "POST",
      body: JSON.stringify({ body: "FIRST", name: "nomad", ctx: { transport: "pad" } }),
    });
    const receipt = await body(post);
    expect(receipt.no).toBe(1);

    const page = await body(await call("/board/GEN/page"));
    expect(page.items[0]).toMatchObject({ no: 1, poster: "nomad", body: "FIRST" });
    expect(typeof page.items[0].ts).toBe("number");
  });

  it("400s a DM missing fields", async () => {
    const res = await call("/dm/send", { method: "POST", body: JSON.stringify({ from: "a" }) });
    expect(res.status).toBe(400);
  });

  it("404s an unknown endpoint", async () => {
    expect((await call("/nope")).status).toBe(404);
  });

  it("serves health without a body payload requirement", async () => {
    const res = await call("/health");
    expect(res.status).toBe(200);
    expect((await body(res)).ok).toBe(true);
  });
});
