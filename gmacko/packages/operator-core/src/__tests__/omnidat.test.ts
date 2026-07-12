import { describe, expect, it } from "vitest";

import {
  buildNetworkSnapshot,
  buildProvisioningTranscript,
  buildVintageTerminalDownloadPackage,
  configurePad,
  executeXotCommand,
  getIso8583ProtocolProfile,
  getOperationalState,
  getVintageTerminalProgramPack,
  omnidatBillingAccounts,
  omnidatCircuitMetrics,
  omnidatFoodMenu,
  omnidatServiceDefinitions,
  processVintagePosSale,
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
    expect(pad.profile).toContain(`XOT HOST omnidat.cc`);
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
    expect(call.transcript).toContain("CONNECT OMNIBUCKS ATM OSC-ATM-1");
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

    expect(profile.protocol).toBe("ISO8583-1987-OMNIBUCKS-X25");
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

  it("processes a vintage dial POS sale with terminal and clerk accountability", () => {
    resetOmnidatOperationalState();

    const sale = processVintagePosSale({
      terminalId: "VF-TR330-NITEMARKT-01",
      terminalModel: "VERIFONE_TRANZ_330",
      merchantAccountId: "SB-CAMP-LAMINAR-001",
      clerkCode: "042",
      amount: 13,
      feePolicyId: "MERCHANT_POS_MERCHANT_PAYS",
      noteSerial: "SBMO-2028-000123-7",
      retrievalReference: "000000000313",
    });
    const state = getOperationalState();

    expect(sale.status).toBe("approved");
    expect(sale.hostX121).toBe("311088002010");
    expect(sale.terminal.x121Origin).toBe("311088040001");
    expect(sale.terminal.model).toBe("VERIFONE_TRANZ_330");
    expect(sale.clerkSession?.clerkCode).toBe("042");
    expect(sale.fee.amount).toBe(0.25);
    expect(sale.iso.responseCode).toBe("00");
    expect(sale.iso.authorizationCode).toMatch(/^SB\d{4}$/);
    expect(sale.transcript).toContain("DIAL 8810");
    expect(sale.transcript).toContain("CONNECT 2400");
    expect(sale.transcript).toContain("CALL 311088002010");
    expect(sale.transcript).toContain("NOTE SBMO-2028-000123-7");
    expect(sale.transcript).toContain("CLERK 042");
    expect(sale.receipt).toContain("OMNIDAT POS RECEIPT");
    expect(sale.receipt).toContain("APPROVED");
    expect(state.ledger[0]).toMatchObject({
      entryKind: "pos-network-fee",
      amount: -0.25,
      accountId: "SB-CAMP-LAMINAR-001",
    });
    expect(state.auditEvents[0]).toMatchObject({
      eventType: "pos.sale.approved",
      subjectKind: "terminal",
      subjectId: "VF-TR330-NITEMARKT-01",
    });
  });

  it("defines a Verifone TCL program pack for ShadyBank sale, refund, and batch flows", () => {
    const pack = getVintageTerminalProgramPack();

    expect(pack.sourceBasis.map((source) => source.shortName)).toEqual(
      expect.arrayContaining([
        "TCL Programmer's Manual",
        "TCLOAD Reference Manual",
        "Omni 3200 Reference Manual",
        "ShadyBank API server",
      ]),
    );
    expect(pack.supportedFamilies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "TRANZ_330_380_TCL",
          models: ["TRANZ 330", "TRANZ 380"],
          primaryRuntime: "VeriFone TCL",
        }),
        expect.objectContaining({
          family: "OMNI_3200_ZONTALK",
          downloadMethods: expect.arrayContaining([
            "direct-zontalk",
            "telephone-zontalk",
          ]),
        }),
      ]),
    );
    expect(pack.capabilities).toEqual(
      expect.arrayContaining([
        "track1-track2-cardreader",
        "keypad-amount-entry",
        "internal-pots-modem",
        "receipt-printer",
        "tcLoad-direct-download",
        "zontalk-telephone-download",
      ]),
    );
    expect(pack.hostBindings.sale).toMatchObject({
      x121: "311088002010",
      shadyBankEndpoints: ["/api/authorize", "/api/capture"],
      paymentInputs: ["track2", "pan+otp", "nfc_token"],
    });
    expect(pack.hostBindings.refund.shadyBankEndpoints).toContain(
      "/api/reverse",
    );
    expect(pack.hostBindings.credit.shadyBankEndpoints).toContain(
      "/api/credit",
    );
    expect(pack.programs.sale.tcl).toContain("OMNIDAT SALE");
    expect(pack.programs.sale.tcl).toContain("DIAL 8810");
    expect(pack.programs.sale.hostMessage).toContain("POS.SALE");
    expect(pack.programs.batchClose.hostMessage).toContain("POS.CLOSE-BATCH");
    expect(pack.deployment.runbook).toEqual(
      expect.arrayContaining([
        expect.stringContaining("TCLOAD direct download"),
        expect.stringContaining("ZONTALK telephone download"),
      ]),
    );
  });

  it("builds TCLOAD/ZONTALK download artifacts with verified TCL primitives and ShadyBank host ports", () => {
    const download = buildVintageTerminalDownloadPackage({
      terminalId: "VF-TR330-NITEMARKT-01",
      merchantAccountId: "SB-CAMP-LAMINAR-001",
      family: "TRANZ_330_380_TCL",
    });

    expect(download.packageId).toBe(
      "OMNIDAT-VF-TCL-2028.1-VF-TR330-NITEMARKT-01",
    );
    expect(download.validationStatus).toBe("bench-validation-required");
    expect(download.portProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pots-sale",
          dialNumber: "8810",
          x121: "311088002010",
          modem: expect.objectContaining({ nominalBaud: 2400 }),
        }),
        expect.objectContaining({
          id: "zontalk-update",
          direction: "host-to-terminal",
          purpose: "telephone application download",
        }),
      ]),
    );
    expect(download.verifiedTclPrimitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "+D",
          purpose: "DTMF tone dial from destination buffer",
        }),
        expect.objectContaining({
          command: "+I",
          purpose: "modem character input/output",
        }),
        expect.objectContaining({
          command: "E",
          purpose: "cardreader or keypad input",
        }),
        expect.objectContaining({
          command: "N",
          purpose: "send destination buffer to printer",
        }),
      ]),
    );
    expect(download.shadyBankProtocol.sale).toMatchObject({
      authorize: {
        method: "POST",
        path: "/api/authorize",
        fields: ["amount", "track2"],
      },
      capture: {
        method: "POST",
        path: "/api/capture",
        fields: ["amount", "auth_code", "description"],
      },
    });
    expect(download.files.map((file) => file.path)).toEqual([
      "OMNISALE.TCL",
      "OMNIDAT.DTZ",
      "CONFIG.SYS",
      "README.TXT",
    ]);
    expect(
      download.files.find((file) => file.path === "OMNISALE.TCL")?.contents,
    ).toContain("+D");
    expect(
      download.files.find((file) => file.path === "OMNISALE.TCL")?.contents,
    ).toContain("+I");
    expect(
      download.files.find((file) => file.path === "OMNISALE.TCL")?.contents,
    ).toContain("POS.SALE|VF-TR330-NITEMARKT-01");
    expect(
      download.files.find((file) => file.path === "CONFIG.SYS")?.contents,
    ).toContain("HOST_DIAL=8810");
    expect(
      download.files.find((file) => file.path === "CONFIG.SYS")?.contents,
    ).toContain("SHADYBANK_TOKEN=FEP_ONLY");
  });
});
