import {
  omnidatBillingAccount,
  omnidatBillingLedgerEntry,
  omnidatPadConfig,
  omnidatProvisioningRequest,
  omnidatShadyBucksAtm,
} from "@omnidat/db/schema";
import { resetOmnidatOperationalState } from "@omnidat/operator-core/omnidat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appRouter } from "../root";

const caller = appRouter.createCaller({} as never);
const originalPersistence = process.env.OMNIDAT_PERSISTENCE;

describe("omnidat tRPC router", () => {
  beforeEach(() => {
    resetOmnidatOperationalState();
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("returns dashboard metrics and network status", async () => {
    const dashboard = await caller.omnidat.dashboard();

    expect(dashboard.network.protocol).toBe("X.25");
    expect(dashboard.metrics.totalServices).toBeGreaterThanOrEqual(5);
    expect(dashboard.metrics.billingAccounts).toBeGreaterThanOrEqual(2);
    expect(dashboard.recentProvisioning[0]?.assignedX121).toBe("311088020184");
  });

  it("returns service verbs and NOC circuit state", async () => {
    const services = await caller.omnidat.services();
    const noc = await caller.omnidat.noc();

    expect(
      services.services
        .find((service) => service.slug === "food-service")
        ?.verbs.map((verb) => verb.name),
    ).toContain("ORDER.CREATE");
    expect(
      services.services
        .find((service) => service.slug === "shadybucks-atm")
        ?.verbs.map((verb) => verb.name),
    ).toContain("ATM.SETUP");
    expect(noc.circuits.map((circuit) => circuit.x121)).toContain(
      "311088030100",
    );
  });

  it("returns ShadyBucks, food protocol, ATM protocol, and provisioning verification", async () => {
    const billing = await caller.omnidat.billing();
    const food = await caller.omnidat.foodProtocol();
    const atm = await caller.omnidat.atmProtocol();
    const verification = await caller.omnidat.verifyProvisioning({
      campsiteName: "Camp Laminar",
      serviceSlug: "food-service",
      transport: "meshcore",
    });

    expect(billing.accounts.map((account) => account.provider)).toContain(
      "ShadyBucks",
    );
    expect(food.menu.map((item) => item.itemId)).toContain("NOODLE-CUP");
    expect(atm.setupChecklist).toContain("Assign X.121 terminal address");
    expect(verification.transcript).toContain("CALL 311088020501");
  });

  it("runs the full V1 operations path across provisioning, PAD, XOT, billing, and NOC state", async () => {
    const provisioned = await caller.omnidat.provisionCampsiteService({
      campsiteName: "Camp Oscillator",
      namespace: "camp",
      contact: "oscillator@example.test",
      appName: "Oscillator Bulletin Board",
      appKind: "message-board",
      transport: "wifi",
    });
    const x121 = provisioned.assignment.assignedX121;
    const pad = await caller.omnidat.configurePad({
      x121,
      transport: "xot",
      padKind: "xot-terminal",
      endpointLabel: "Camp Oscillator laptop terminal",
    });
    const terminal = await caller.omnidat.xotCommand({
      sourceX121: x121,
      command: `CALL ${x121}`,
    });
    const operations = await caller.omnidat.operations();
    const dashboard = await caller.omnidat.dashboard();
    const noc = await caller.omnidat.noc();

    expect(provisioned.status).toBe("verified");
    expect(pad.profile).toContain("XOT HOST omnidat.gmac.io");
    expect(terminal.transcript).toContain("CONNECT OSCILLATOR BULLETIN BOARD");
    expect(operations.pads.map((entry) => entry.x121)).toContain(x121);
    expect(operations.ledger[0]?.memo).toContain("X.121 provisioning");
    expect(dashboard.metrics.pendingProvisioning).toBeGreaterThanOrEqual(2);
    expect(noc.circuits.map((circuit) => circuit.x121)).toContain(x121);
  });

  it("sets up a ShadyBucks ATM terminal and reflects billing activation", async () => {
    const atm = await caller.omnidat.setupAtmTerminal({
      terminalId: "OSC-ATM-1",
      settlementAccountId: "SB-ATM-EX88-100",
      locationLabel: "Camp Oscillator cashier window",
    });
    const operations = await caller.omnidat.operations();
    const bill = await caller.omnidat.xotCommand({
      sourceX121: atm.terminalX121,
      command: "BILL SB-ATM-EX88-100",
    });

    expect(atm.activationCode).toContain("READY");
    expect(operations.ledger[0]?.entryKind).toBe("atm-activation");
    expect(bill.transcript).toContain("BALANCE");
  });

  it("exposes detailed ISO 8583 support for ShadyBucks ATM transactions", async () => {
    const atm = await caller.omnidat.atmProtocol();
    const iso = await (
      caller.omnidat as unknown as {
        iso8583Transaction: (input: {
          mti: "0200";
          processingCode: "000000";
          amount: number;
          accountId: string;
          terminalId: string;
          retrievalReference: string;
        }) => Promise<{
          protocol: string;
          responseMti: string;
          responseCode: string;
          packedRequest: string;
          transcript: string;
        }>;
      }
    ).iso8583Transaction({
      mti: "0200",
      processingCode: "000000",
      amount: 19,
      accountId: "SB-CAMP-LAMINAR-001",
      terminalId: "ATM-EX88-001",
      retrievalReference: "000000000019",
    });

    expect(atm.iso8583?.fields.map((field) => field.bit)).toContain(39);
    expect(atm.iso8583?.messageTypes.map((message) => message.mti)).toContain(
      "0200",
    );
    expect(iso.protocol).toBe("ISO8583-1987-SHADYBUCKS-X25");
    expect(iso.responseMti).toBe("0210");
    expect(iso.responseCode).toBe("00");
    expect(iso.packedRequest).toContain("DE004=000000001900");
    expect(iso.packedRequest).not.toContain("PIN");
    expect(iso.transcript).toContain("ISO8583 0200 -> 0210");
  });

  it("settles ISO 8583 purchases through the real Shady Bank HTTP contract", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("246810", { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const integrationCaller = appRouter.createCaller({
      shadyBank: {
        baseUrl: "http://127.0.0.1:8021",
        merchantToken: "merchant-token",
        fetch,
      },
    } as never);

    const status = await integrationCaller.omnidat.shadyBankStatus();
    const settlement = await integrationCaller.omnidat.iso8583ShadyBankPurchase(
      {
        amount: 19,
        pan: "4242424242424242",
        otp: "123456",
        terminalId: "ATM-EX88-001",
        retrievalReference: "000000000019",
      },
    );

    expect(status.profile.sourceRepo).toBe("/Volumes/dev/shady/shadybank");
    expect(status.profile.configured).toBe(true);
    expect(settlement.responseCode).toBe("00");
    expect(settlement.responseMti).toBe("0210");
    expect(settlement.shadyBank.authCode).toBe("246810");
    expect(settlement.shadyBank.captured).toBe(true);
    expect(settlement.transcript).toContain("SHADYBANK POST /api/authorize");
    expect(settlement.transcript).not.toContain("4242424242424242");
  });

  it("settles ISO 8583 purchases with Shady Bank track-2 card data", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("751860", { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const integrationCaller = appRouter.createCaller({
      shadyBank: {
        baseUrl: "http://192.168.97.4:8080",
        merchantToken: "merchant-token",
        fetch,
      },
    } as never);

    const settlement = await integrationCaller.omnidat.iso8583ShadyBankPurchase(
      {
        amount: 19.25,
        track2: ";4111111111111111=2901123123456?",
        terminalId: "ATM-EX88-001",
        retrievalReference: "000000000020",
      } as never,
    );

    expect(settlement.responseCode).toBe("00");
    expect(settlement.shadyBank.authCode).toBe("751860");
    expect(settlement.packedResponse).toContain("DE038=751860");
    expect(settlement.packedResponse).toContain("DE039=00");
    expect(settlement.transcript).toContain("TRACK2 ************1111");
    expect(settlement.transcript).toContain("RC 00");
    expect(settlement.transcript).toContain("AUTH 751860");
    expect(settlement.transcript).not.toContain("AUTH DECLIN");
    expect(settlement.transcript).not.toContain("4111111111111111");
    expect(
      ((fetch.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams).get(
        "track2",
      ),
    ).toBe(";4111111111111111=2901123123456?");
  });

  it("runs a vintage Verifone-style dial POS sale through the OMNIDAT FEP", async () => {
    const sale = await (
      caller.omnidat as unknown as {
        vintagePosSale: (input: {
          terminalId: string;
          terminalModel: "VERIFONE_TRANZ_330";
          merchantAccountId: string;
          clerkCode: string;
          amount: number;
          feePolicyId: string;
          noteSerial: string;
          retrievalReference: string;
        }) => Promise<{
          status: string;
          hostX121: string;
          terminal: { x121Origin: string };
          fee: { amount: number; policyId: string };
          iso: { responseCode: string };
          transcript: string;
          receipt: string;
        }>;
      }
    ).vintagePosSale({
      terminalId: "VF-TR330-NITEMARKT-01",
      terminalModel: "VERIFONE_TRANZ_330",
      merchantAccountId: "SB-CAMP-LAMINAR-001",
      clerkCode: "042",
      amount: 13,
      feePolicyId: "MERCHANT_POS_MERCHANT_PAYS",
      noteSerial: "SBMO-2028-000123-7",
      retrievalReference: "000000000313",
    });
    const operations = await caller.omnidat.operations();

    expect(sale.status).toBe("approved");
    expect(sale.hostX121).toBe("311088002010");
    expect(sale.terminal.x121Origin).toBe("311088040001");
    expect(sale.fee.policyId).toBe("MERCHANT_POS_MERCHANT_PAYS");
    expect(sale.fee.amount).toBe(0.25);
    expect(sale.iso.responseCode).toBe("00");
    expect(sale.transcript).toContain("DIAL 8810");
    expect(sale.transcript).toContain("CONNECT SHADYBUCKS POS AUTHORIZATION");
    expect(sale.receipt).toContain("OMNIDAT POS RECEIPT");
    expect(operations.ledger[0]?.entryKind).toBe("pos-network-fee");
  });

  it("exposes the vintage Verifone terminal program pack", async () => {
    const pack = await (
      caller.omnidat as unknown as {
        vintageTerminalProgramPack: () => Promise<{
          version: string;
          sourceBasis: { shortName: string }[];
          capabilities: string[];
          hostBindings: {
            sale: {
              x121: string;
              shadyBankEndpoints: string[];
            };
          };
          programs: {
            sale: {
              tcl: string;
              hostMessage: string;
            };
          };
        }>;
      }
    ).vintageTerminalProgramPack();

    expect(pack.version).toBe("OMNIDAT-VF-TCL-2028.1");
    expect(pack.sourceBasis.map((source) => source.shortName)).toContain(
      "TCL Programmer's Manual",
    );
    expect(pack.capabilities).toContain("internal-pots-modem");
    expect(pack.hostBindings.sale.x121).toBe("311088002010");
    expect(pack.hostBindings.sale.shadyBankEndpoints).toEqual([
      "/api/authorize",
      "/api/capture",
    ]);
    expect(pack.programs.sale.tcl).toContain("DIAL 8810");
    expect(pack.programs.sale.hostMessage).toContain("POS.SALE");
  });

  it("builds a vintage terminal download package for TCLOAD and ZONTALK updates", async () => {
    const download = await (
      caller.omnidat as unknown as {
        vintageTerminalDownloadPackage: (input: {
          terminalId: string;
          merchantAccountId: string;
          family: "TRANZ_330_380_TCL";
        }) => Promise<{
          packageId: string;
          portProfiles: { id: string; dialNumber: string; x121: string }[];
          files: { path: string; contents: string }[];
          shadyBankProtocol: {
            sale: {
              authorize: { path: string };
              capture: { path: string };
            };
          };
        }>;
      }
    ).vintageTerminalDownloadPackage({
      terminalId: "VF-TR330-NITEMARKT-01",
      merchantAccountId: "SB-CAMP-LAMINAR-001",
      family: "TRANZ_330_380_TCL",
    });

    expect(download.packageId).toContain("VF-TR330-NITEMARKT-01");
    expect(download.portProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "pots-sale", dialNumber: "8810" }),
        expect.objectContaining({ id: "zontalk-update", x121: "311088002020" }),
      ]),
    );
    expect(download.shadyBankProtocol.sale.authorize.path).toBe(
      "/api/authorize",
    );
    expect(download.shadyBankProtocol.sale.capture.path).toBe("/api/capture");
    expect(download.files.map((file) => file.path)).toContain("OMNISALE.TCL");
    expect(
      download.files.find((file) => file.path === "OMNISALE.TCL")?.contents,
    ).toContain("+I");
  });

  it("creates a Miliways food order with ShadyBucks billing and durable order persistence", async () => {
    const orderProcedure = (caller.omnidat as { createFoodOrder?: unknown })
      .createFoodOrder;

    expect(typeof orderProcedure).toBe("function");

    const order = await (
      orderProcedure as (input: {
        itemIds: string[];
        pickupName: string;
        shadybucksAccountId: string;
      }) => Promise<{
        orderId: string;
        lineTicket: string;
        receiptId: string;
        total: number;
        estimatedWaitMinutes: number;
      }>
    )({
      itemIds: ["NOODLE-CUP", "TEA-THERMOS"],
      pickupName: "Packet Window 3",
      shadybucksAccountId: "SB-CAMP-LAMINAR-001",
    });
    const operations = await caller.omnidat.operations();

    expect(order.lineTicket).toMatch(/^MW-/);
    expect(order.receiptId).toMatch(/^RCPT-FOOD-/);
    expect(order.total).toBe(11);
    expect(order.estimatedWaitMinutes).toBeGreaterThan(0);
    expect(operations.ledger[0]?.entryKind).toBe("food-order");
    expect(operations.ledger[0]?.amount).toBe(-11);

    process.env.OMNIDAT_PERSISTENCE = "database";
    let id = 0;
    const returning = vi.fn(async () => [{ id: `row-${++id}` }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate, returning }));
    const persistentCaller = appRouter.createCaller({
      db: {
        insert: vi.fn(() => ({
          values,
        })),
      },
    } as never);
    const persistentFoodOrder = (
      persistentCaller.omnidat as unknown as {
        createFoodOrder: (input: {
          itemIds: string[];
          pickupName: string;
          shadybucksAccountId: string;
        }) => Promise<unknown>;
      }
    ).createFoodOrder;
    await persistentFoodOrder({
      itemIds: ["NOODLE-CUP"],
      pickupName: "Durable Diner",
      shadybucksAccountId: "SB-CAMP-LAMINAR-001",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        lineTicket: expect.stringMatching(/^MW-/),
        pickupName: "Durable Diner",
        totalAmount: 7,
        status: "received",
      }),
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "food.order.created",
        subjectKind: "food-order",
      }),
    );
  });

  it("stamps an activity passport with merit badge evidence and durable persistence", async () => {
    const stampProcedure = (
      caller.omnidat as { stampActivityPassport?: unknown }
    ).stampActivityPassport;

    expect(typeof stampProcedure).toBe("function");

    const stamp = await (
      stampProcedure as (input: {
        passportId: string;
        badgeId: string;
        operatorId: string;
        evidence: string;
      }) => Promise<{
        stampId: string;
        receiptId: string;
        meritClaimStatus: string;
        transcript: string;
      }>
    )({
      passportId: "PASS-04271",
      badgeId: "FIELD-COURIER",
      operatorId: "OP-EX88",
      evidence: "Delivered a packet form across camp.",
    });
    const operations = await caller.omnidat.operations();
    const passportStamps = (
      operations as unknown as {
        passportStamps: Array<{ stampId: string; badgeId: string }>;
      }
    ).passportStamps;

    expect(stamp.stampId).toMatch(/^STAMP-/);
    expect(stamp.receiptId).toMatch(/^RCPT-PASS-/);
    expect(stamp.meritClaimStatus).toBe("filed");
    expect(stamp.transcript).toContain("CONNECT PASSPORT LOG ENTRY");
    expect(passportStamps[0]).toMatchObject({
      stampId: stamp.stampId,
      badgeId: "FIELD-COURIER",
    });

    process.env.OMNIDAT_PERSISTENCE = "database";
    const values = vi.fn(() => ({}));
    const persistentCaller = appRouter.createCaller({
      db: {
        insert: vi.fn(() => ({
          values,
        })),
      },
    } as never);
    const persistentStamp = (
      persistentCaller.omnidat as unknown as {
        stampActivityPassport: (input: {
          passportId: string;
          badgeId: string;
          operatorId: string;
          evidence: string;
        }) => Promise<unknown>;
      }
    ).stampActivityPassport;
    await persistentStamp({
      passportId: "PASS-02024",
      badgeId: "PACKET-NOTARY",
      operatorId: "OP-DURABLE",
      evidence: "Filed a witnessed X.25 network receipt.",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        passportId: "PASS-02024",
        badgeId: "PACKET-NOTARY",
        status: "filed",
      }),
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "passport.stamped",
        subjectKind: "passport",
        subjectId: "PASS-02024",
      }),
    );
  });

  it("records durable audit events when database persistence is enabled", async () => {
    process.env.OMNIDAT_PERSISTENCE = "database";
    let id = 0;
    const returning = vi.fn(async () => [{ id: `row-${++id}` }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate, returning }));
    const db = {
      insert: vi.fn(() => ({
        values,
      })),
    };
    const persistentCaller = appRouter.createCaller({ db } as never);

    const provisioned = await persistentCaller.omnidat.provisionCampsiteService(
      {
        campsiteName: "Camp Durable",
        namespace: "camp",
        contact: "durable@example.test",
        appName: "Durable Bulletin",
        appKind: "message-board",
        transport: "wifi",
      },
    );
    await persistentCaller.omnidat.configurePad({
      x121: provisioned.assignment.assignedX121,
      transport: "xot",
      padKind: "xot-terminal",
      endpointLabel: "Camp Durable terminal",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "provisioning.verified",
        subjectId: provisioned.assignment.assignedX121,
      }),
    );
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "pad.configured",
        subjectId: provisioned.assignment.assignedX121,
      }),
    );
  });

  it("reads operational dashboards from persisted OMNIDAT rows when database persistence is enabled", async () => {
    process.env.OMNIDAT_PERSISTENCE = "database";
    const rowsByTable = new Map<unknown, unknown[]>([
      [
        omnidatProvisioningRequest,
        [
          {
            id: "pv-db-1",
            assignedX121: "311088029999",
            transport: "xot",
            status: "verified",
          },
        ],
      ],
      [
        omnidatBillingAccount,
        [
          {
            externalAccountId: "SB-CAMP-DATABASE-001",
            provider: "ShadyBucks",
            accountType: "camp-operating",
            displayName: "Camp Database",
            status: "linked-demo",
            balanceAmount: 1212,
            currency: "SHDY",
          },
        ],
      ],
      [
        omnidatBillingLedgerEntry,
        [
          {
            id: "ledger-db-1",
            accountId: "billing-db-1",
            entryKind: "provisioning-fee",
            amount: -25,
            currency: "SHDY",
            memo: "X.121 provisioning for Camp Database",
            externalReceiptId: "RCPT-PV-029999",
          },
        ],
      ],
      [
        omnidatPadConfig,
        [
          {
            id: "pad-db-1",
            x121: "311088029999",
            transport: "xot",
            padKind: "xot-terminal",
            endpointLabel: "Camp Database terminal",
            status: "configured",
            profile: "XOT HOST omnidat.gmac.io\nCALL 311088029999",
          },
        ],
      ],
      [
        omnidatShadyBucksAtm,
        [
          {
            id: "atm-db-1",
            terminalId: "DB-ATM-1",
            terminalX121: "311088039999",
            locationLabel: "Camp Database cashier",
            status: "active",
          },
        ],
      ],
    ]);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async (table: unknown) => rowsByTable.get(table) ?? []),
      })),
    };
    const persistentCaller = appRouter.createCaller({ db } as never);

    const dashboard = await persistentCaller.omnidat.dashboard();
    const billing = await persistentCaller.omnidat.billing();
    const operations = await persistentCaller.omnidat.operations();
    const noc = await persistentCaller.omnidat.noc();

    expect(dashboard.metrics.billingAccounts).toBe(1);
    expect(dashboard.metrics.pendingProvisioning).toBe(1);
    expect(dashboard.recentProvisioning[0]?.assignedX121).toBe("311088029999");
    expect(billing.accounts[0]?.accountId).toBe("SB-CAMP-DATABASE-001");
    expect(operations.ledger[0]?.receiptId).toBe("RCPT-PV-029999");
    expect(operations.pads[0]?.endpointLabel).toBe("Camp Database terminal");
    expect(noc.services.map((service) => service.slug)).toContain("directory");
    expect(noc.circuits.map((circuit) => circuit.x121)).toContain(
      "311088029999",
    );
    expect(noc.circuits.map((circuit) => circuit.x121)).toContain(
      "311088039999",
    );
  });
});
