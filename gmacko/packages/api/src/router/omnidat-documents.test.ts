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

  it("renders a printed operator license card", () => {
    const card = buildOmnidatDocument("operator-license", {
      operator: "RED-LINE-27",
      role: "packet-operator",
      licenseNo: "OP-0007",
      examDate: "2027-03-14",
      capabilities: "services, allocations, sessions, evidence",
    });
    expect(card.title).toBe("OMNIDAT OPERATOR LICENSE");
    expect(card.body).toContain("ROLE: PACKET-OPERATOR");
    expect(card.body).toContain("LICENSE NO: OP-0007");
    expect(card.body).toContain("CAPABILITIES: SERVICES, ALLOCATIONS");
  });

  it("renders camp deployment summary for ToorCamp 2028 / CC Camp 2027", () => {
    const camp = buildOmnidatDocument("camp-deployment-summary", {
      event: "TOORCAMP-2028",
      scope: "OPT-IN VILLAGE",
      dates: "2028-07",
      shadytel: "PRI REQUESTED",
      services: "25",
      apps: "12",
      allocations: "87",
    });
    expect(camp.title).toBe("CAMP DEPLOYMENT SUMMARY");
    expect(camp.body).toContain("TOORCAMP-2028");
    expect(camp.body).toContain("See README");
  });

  it("falls back gracefully for missing fields", () => {
    const document = buildOmnidatDocument("address-assignment", {});
    expect(document.body).toContain("X.121: -");
    expect(document.body).toContain("STATUS: RESERVED");
  });
});
