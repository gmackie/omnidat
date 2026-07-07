import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BridgeStore } from "../store.js";

// A fixed clock so timestamps are deterministic (09:30 local for board math is
// asserted via the raw ms; mailbox HH:MM is derived from the same instant).
const T = new Date("2026-07-07T09:30:00").getTime();

describe("BridgeStore — DMs", () => {
  it("delivers a message to the recipient's mailbox with a receipt", () => {
    const store = new BridgeStore({ now: () => T });
    const receipt = store.sendDm("041027", "042713", "SEE YOU AT MILIWAYS");
    expect(receipt.rcpt).toMatch(/^MSG-\d{5}$/u);
    expect(receipt.eventId).toMatch(/^\$evt-/u);

    const box = store.mailbox("042713");
    expect(box).toHaveLength(1);
    expect(box[0]).toMatchObject({ no: 1, from: "041027", body: "SEE YOU AT MILIWAYS" });
    expect(box[0]!.ts).toMatch(/^\d{2}:\d{2}$/u);
  });

  it("increments the per-recipient number and only returns unread mail", () => {
    const store = new BridgeStore({ now: () => T });
    store.sendDm("a", "042713", "one");
    store.sendDm("b", "042713", "two");
    expect(store.mailbox("042713").map((m) => m.no)).toEqual([1, 2]);
    store.markRead("042713");
    expect(store.mailbox("042713")).toHaveLength(0);
    // New mail after a read still arrives.
    store.sendDm("c", "042713", "three");
    expect(store.mailbox("042713").map((m) => m.body)).toEqual(["three"]);
  });

  it("keeps mailboxes separate per recipient", () => {
    const store = new BridgeStore({ now: () => T });
    store.sendDm("x", "aaa", "for aaa");
    store.sendDm("x", "bbb", "for bbb");
    expect(store.mailbox("aaa").map((m) => m.body)).toEqual(["for aaa"]);
    expect(store.mailbox("bbb").map((m) => m.body)).toEqual(["for bbb"]);
  });
});

describe("BridgeStore — boards", () => {
  it("posts and pages with per-board numbering and raw ms timestamps", () => {
    const store = new BridgeStore({ now: () => T });
    const r1 = store.boardPost("GEN", "FIRST LIGHT", { name: "nomad" });
    const r2 = store.boardPost("GEN", "SECOND", { ctx: { transport: "pad" } });
    expect(r1.no).toBe(1);
    expect(r2.no).toBe(2);
    const page = store.boardPage("GEN");
    expect(page).toHaveLength(2);
    expect(page[0]).toMatchObject({ no: 1, poster: "nomad", body: "FIRST LIGHT", ts: T });
    // No name → "anon".
    expect(page[1]!.poster).toBe("anon");
  });

  it("supports the after= cursor", () => {
    const store = new BridgeStore({ now: () => T });
    store.boardPost("GEN", "a");
    store.boardPost("GEN", "b");
    store.boardPost("GEN", "c");
    expect(store.boardPage("GEN", 1).map((p) => p.body)).toEqual(["b", "c"]);
  });
});

describe("BridgeStore — durability", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("replays the journal on restart", () => {
    dir = mkdtempSync(join(tmpdir(), "bridge-"));
    const path = join(dir, "journal.jsonl");
    const a = new BridgeStore({ path, now: () => T });
    a.sendDm("041027", "042713", "PERSIST ME");
    a.boardPost("GEN", "PERSIST TOO", { name: "nomad" });

    // A fresh store over the same journal recovers state.
    const b = new BridgeStore({ path, now: () => T });
    expect(b.mailbox("042713").map((m) => m.body)).toEqual(["PERSIST ME"]);
    expect(b.boardPage("GEN").map((p) => p.body)).toEqual(["PERSIST TOO"]);
    // Numbering continues, not restarts.
    expect(b.boardPost("GEN", "NEXT").no).toBe(2);
  });
});
