import { describe, expect, it } from "vitest";

import {
  buildNetworkSnapshot,
  buildProvisioningTranscript,
  configurePad,
  executeXotCommand,
  getIso8583ProtocolProfile,
  getOperationalState,
  omnidatBillingAccounts,
  omnidatCircuitMetrics,
  omnidatFoodMenu,
  omnidatServiceDefinitions,
  provisionCampsiteService,
  resetOmnidatOperationalState,
  setupAtmTerminal,
  simulateIso8583Transaction,
} from "../omnidat";

describe("OMNIDAT operational model", () => {
  it("defines X.25 services with verbs, inputs, outputs, and X.121 addresses", () => {
    const food = omnidatServiceDefinitions.find(
      (service) => service.slug === "food-service",
    );
    const atm = omnidatServiceDefinitions.find(
      (service) => service.slug === "shadybucks-atm",
    );

    expect(food?.x121).toBe("311088020501");
    expect(food?.verbs.map((verb) => verb.name)).toContain("ORDER.CREATE");
    expect(food?.verbs.find((verb) => verb.name === "QUOTE")?.inputs).toContain(
      "shadybucksAccountId",
    );
    expect(atm?.x121).toBe("311088030100");
    expect(atm?.verbs.map((verb) => verb.name)).toContain("ATM.SETUP");
    expect(
      atm?.verbs.find((verb) => verb.name === "WITHDRAW")?.outputs,
    ).toContain("authorizationCode");
  });

  it("defines ShadyBucks accounts, ATM settlement, food menu, and circuit metrics", () => {
    expect(omnidatBillingAccounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "ShadyBucks",
          type: "atm-settlement",
        }),
      ]),
    );
    expect(omnidatFoodMenu).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: "NOODLE-CUP", priceShadyBucks: 7 }),
      ]),
    );
    expect(omnidatCircuitMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x121: "311088030100", status: "up" }),
      ]),
    );
  });

  it("builds network snapshots and provisioning transcripts", () => {
    const snapshot = buildNetworkSnapshot();
    const transcript = buildProvisioningTranscript({
      campsiteName: "Camp Laminar",
      serviceSlug: "food-service",
      transport: "meshcore",
    });

    expect(snapshot.protocol).toBe("X.25");
    expect(snapshot.source).toBe("seeded-exchange-88-adapter");
    expect(snapshot.services.map((service) => service.slug)).toContain(
      "shadybucks-atm",
    );
    expect(transcript.status).toBe("verified");
    expect(transcript.assignment.x121).toBe("311088020184");
    expect(transcript.transcript).toContain("CALL 311088020501");
  });

  it("provisions an X.121 app, configures an XOT PAD, and exposes it to terminal/NOC/billing state", () => {
    resetOmnidatOperationalState();

    const provisioned = provisionCampsiteService({
      campsiteName: "Camp Oscillator",
      namespace: "camp",
      contact: "oscillator@example.test",
      appName: "Oscillator Bulletin Board",
      appKind: "message-board",
      transport: "wifi",
    });
    const pad = configurePad({
      x121: provisioned.assignment.assignedX121,
      transport: "xot",
      padKind: "xot-terminal",
      endpointLabel: "Camp Oscillator laptop terminal",
    });
    const call = executeXotCommand({
      sourceX121: provisioned.assignment.assignedX121,
      command: `CALL ${provisioned.assignment.assignedX121}`,
    });
    const directory = executeXotCommand({
      sourceX121: provisioned.assignment.assignedX121,
      command: "DIR CAMP",
    });
    const state = getOperationalState();

    expect(provisioned.assignment.assignedX121).toMatch(/^31108802\d{4}$/);
    expect(provisioned.billing.ledgerEntry.memo).toContain(
      "X.121 provisioning",
    );
    expect(pad.profile).toContain(`XOT HOST omnidat.gmac.io`);
    expect(call.transcript).toContain("CONNECT OSCILLATOR BULLETIN BOARD");
    expect(directory.transcript).toContain(provisioned.assignment.assignedX121);
    expect(state.pads.map((entry) => entry.x121)).toContain(
      provisioned.assignment.assignedX121,
    );
    expect(
      buildNetworkSnapshot().circuits.map((circuit) => circuit.x121),
    ).toContain(provisioned.assignment.assignedX121);
  });

  it("registers activated ATM terminals as callable X.25 services", () => {
    resetOmnidatOperationalState();

    const atm = setupAtmTerminal({
      terminalId: "OSC-ATM-1",
      settlementAccountId: "SB-ATM-EX88-100",
      locationLabel: "Camp Oscillator cashier window",
    });
    const call = executeXotCommand({
      sourceX121: atm.terminalX121,
      command: `CALL ${atm.terminalX121}`,
    });
    const status = executeXotCommand({
      sourceX121: atm.terminalX121,
      command: `STATUS ${atm.terminalX121}`,
    });

    expect(call.status).toBe("ok");
    expect(call.transcript).toContain("CONNECT SHADYBUCKS ATM OSC-ATM-1");
    expect(call.transcript).toContain("VERBS BALANCE, WITHDRAW, DEPOSIT");
    expect(status.transcript).toContain(`STATUS ${atm.terminalX121} UP xot`);
  });

  it("models ISO 8583 ATM messages with redacted packed fields over X.25", () => {
    const profile = getIso8583ProtocolProfile();
    const purchase = simulateIso8583Transaction({
      mti: "0200",
      processingCode: "000000",
      amount: 42,
      accountId: "SB-CAMP-LAMINAR-001",
      terminalId: "ATM-EX88-001",
      retrievalReference: "123456789012",
    });

    expect(profile.protocol).toBe("ISO8583-1987-SHADYBUCKS-X25");
    expect(profile.fields.map((field) => field.bit)).toContain(3);
    expect(profile.fields.find((field) => field.bit === 52)?.sensitive).toBe(
      true,
    );
    expect(purchase.responseMti).toBe("0210");
    expect(purchase.responseCode).toBe("00");
    expect(purchase.authorizationCode).toMatch(/^SB\d{4}$/);
    expect(purchase.packedRequest).toContain("MTI=0200");
    expect(purchase.packedRequest).toContain("DE003=000000");
    expect(purchase.packedRequest).toContain("DE004=000000004200");
    expect(purchase.packedRequest).not.toContain("PIN");
    expect(purchase.transcript).toContain("CALL 311088030100");
    expect(purchase.transcript).toContain("ISO8583 0200 -> 0210");
  });
});
