import { describe, expect, it } from "vitest";

import { buildOmnidatDocument } from "./omnidat-documents";

describe("OMNIDAT printable documents", () => {
  it("renders an address assignment with its required fields", () => {
    const document = buildOmnidatDocument("address-assignment", {
      x121: "311088020777",
      campsite: "Camp Oscillator",
      transport: "xot",
      status: "verified",
    });
    expect(document.title).toBe("X.121 ADDRESS ASSIGNMENT");
    expect(document.body).toContain("X.121: 311088020777");
    expect(document.body).toContain("CAMPSITE: Camp Oscillator");
    expect(document.body).toContain("TRANSPORT: XOT");
    expect(document.body).toContain("STATUS: VERIFIED");
  });

  it("renders a demarc sheet, certificate, transcript, and daily summary", () => {
    expect(
      buildOmnidatDocument("demarc-sheet", { service: "Directory", endpoint: "PAD-1" }).body,
    ).toContain("SERVICE DEMARCATION SHEET");
    expect(
      buildOmnidatDocument("service-certificate", { service: "Directory", verbs: "dir,lookup" }).body,
    ).toContain("VERBS: DIR,LOOKUP");
    expect(
      buildOmnidatDocument("provisioning-transcript", { x121: "311088020777", transcript: "STATUS VERIFIED" }).body,
    ).toContain("STATUS VERIFIED");
    const summary = buildOmnidatDocument("daily-noc-summary", {
      date: "2028-07-01",
      sessions: 312,
      incidents: 2,
    });
    expect(summary.body).toContain("PACKET SESSIONS: 312");
    expect(summary.body).toContain("INCIDENTS: 2");
  });

  it("falls back gracefully for missing fields", () => {
    const document = buildOmnidatDocument("address-assignment", {});
    expect(document.body).toContain("X.121: -");
    expect(document.body).toContain("STATUS: RESERVED");
  });
});
