import {
  omnidatAuditEvent,
  omnidatBillingAccount,
  omnidatBillingLedgerEntry,
  omnidatEventAuthority,
  omnidatEvidenceArtifact,
  omnidatJournalEntry,
  omnidatNetworkMetric,
  omnidatOperatorRole,
  omnidatPacketSession,
  omnidatPadConfig,
  omnidatProvisioningRequest,
  omnidatShadyBucksAtm,
  omnidatSyncSource,
} from "@omnidat/db/schema";
import { resetOmnidatOperationalState } from "@omnidat/operator-core/omnidat";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appRouter } from "../root";
import { omnidatRouter } from "./omnidat";
import { journalPayloadChecksum } from "./omnidat-sync";
import type { OmnidatRole } from "./omnidat-roles";

const caller = appRouter.createCaller({} as never);
const originalPersistence = process.env.OMNIDAT_PERSISTENCE;

// A db that answers loadActiveOperatorRoles with the given roles for the
// session user. Persistence stays off in these tests, so operational reads
// fall back to seed state and no domain rows are written.
function roleDb(userId: string, roles: OmnidatRole[]) {
  return {
    select: () => ({
      from: async (table: unknown) =>
        table === omnidatOperatorRole
          ? roles.map((role) => ({ userId, role, active: true }))
          : [],
    }),
    insert: () => ({
      values: () => ({ onConflictDoUpdate: () => ({}), returning: async () => [] }),
    }),
  };
}

// Add an operator-role select() onto a persistence mock db so gated mutations
// pass while the test keeps its own insert spies for durability assertions.
function withRoles(db: Record<string, unknown>, userId: string, roles: OmnidatRole[]) {
  return {
    ...db,
    select: () => ({
      from: async (table: unknown) =>
        table === omnidatOperatorRole
          ? roles.map((role) => ({ userId, role, active: true }))
          : [],
    }),
  };
}

const OPERATOR_SESSION = { session: { user: { id: "user-admin" } } };

function operatorCaller(roles: OmnidatRole[], extraCtx: Record<string, unknown> = {}) {
  const userId = `user-${roles.join("-") || "none"}`;
  return appRouter.createCaller({
    db: roleDb(userId, roles),
    session: { user: { id: userId } },
    ...extraCtx,
  } as never);
}

const adminCaller = operatorCaller(["admin"]);

// Token-authenticated procedures (Split Authority Sync) authenticate with a
// per-source sync token, not an operator session, so they carry no capability
// from the role matrix. Any addition here must name its authentication mode.
// syncPush/syncPull and transferAuthority all verify the sync token in-body.
const SYNC_TOKEN_EXCEPTIONS = ["syncPush", "syncPull"];

describe("omnidat router role-gating coverage", () => {
  it("role-gates and audits every omnidat mutation", () => {
    for (const [name, procedure] of Object.entries(omnidatRouter)) {
      const def = (procedure as { _def?: { type?: string; meta?: unknown } })._def;
      if (def?.type !== "mutation") continue;
      if (SYNC_TOKEN_EXCEPTIONS.includes(name)) continue;
      const meta = def.meta as
        | { omnidat?: { capability?: string; audited?: boolean } }
        | undefined;
      expect(meta?.omnidat?.audited, `${name} must be audited`).toBe(true);
      expect(
        meta?.omnidat?.capability,
        `${name} must carry a capability gate`,
      ).toBeDefined();
    }
  });
});

describe("omnidat tRPC router", () => {
  beforeEach(() => {
    resetOmnidatOperationalState();
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("returns dashboard metrics and network status", async () => {
    const dashboard = await adminCaller.omnidat.dashboard();

    expect(dashboard.network.protocol).toBe("X.25");
    expect(dashboard.metrics.totalServices).toBeGreaterThanOrEqual(5);
    expect(dashboard.metrics.billingAccounts).toBeGreaterThanOrEqual(2);
    expect(dashboard.recentProvisioning[0]?.assignedX121).toBe("311088020184");
  });

  it("returns service verbs and NOC circuit state", async () => {
    const services = await caller.omnidat.services();
    const noc = await adminCaller.omnidat.noc();

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
    const billing = await adminCaller.omnidat.billing();
    const food = await caller.omnidat.foodProtocol();
    const atm = await caller.omnidat.atmProtocol();
    const verification = await adminCaller.omnidat.verifyProvisioning({
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
    const provisioned = await adminCaller.omnidat.provisionCampsiteService({
      campsiteName: "Camp Oscillator",
      namespace: "camp",
      contact: "oscillator@example.test",
      appName: "Oscillator Bulletin Board",
      appKind: "message-board",
      transport: "wifi",
    });
    const x121 = provisioned.assignment.assignedX121;
    const pad = await adminCaller.omnidat.configurePad({
      x121,
      transport: "xot",
      padKind: "xot-terminal",
      endpointLabel: "Camp Oscillator laptop terminal",
    });
    const terminal = await adminCaller.omnidat.xotCommand({
      sourceX121: x121,
      command: `CALL ${x121}`,
    });
    const operations = await adminCaller.omnidat.operations();
    const dashboard = await adminCaller.omnidat.dashboard();
    const noc = await adminCaller.omnidat.noc();

    expect(provisioned.status).toBe("verified");
    expect(pad.profile).toContain("XOT HOST omnidat.cc");
    expect(terminal.transcript).toContain("CONNECT OSCILLATOR BULLETIN BOARD");
    expect(operations.pads.map((entry) => entry.x121)).toContain(x121);
    expect(operations.ledger[0]?.memo).toContain("X.121 provisioning");
    expect(dashboard.metrics.pendingProvisioning).toBeGreaterThanOrEqual(2);
    expect(noc.circuits.map((circuit) => circuit.x121)).toContain(x121);
  });

  it("sets up a ShadyBucks ATM terminal and reflects billing activation", async () => {
    const atm = await adminCaller.omnidat.setupAtmTerminal({
      terminalId: "OSC-ATM-1",
      settlementAccountId: "SB-ATM-EX88-100",
      locationLabel: "Camp Oscillator cashier window",
    });
    const operations = await adminCaller.omnidat.operations();
    const bill = await adminCaller.omnidat.xotCommand({
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
      adminCaller.omnidat as unknown as {
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
    expect(iso.protocol).toBe("ISO8583-1987-OMNIBUCKS-X25");
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
      db: roleDb("user-bank", ["bank-operator"]),
      session: { user: { id: "user-bank" } },
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
    expect(settlement.transcript).toContain("OMNIBANK POST /api/authorize");
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
      db: roleDb("user-bank", ["bank-operator"]),
      session: { user: { id: "user-bank" } },
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
      adminCaller.omnidat as unknown as {
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
    const operations = await adminCaller.omnidat.operations();

    expect(sale.status).toBe("approved");
    expect(sale.hostX121).toBe("311088002010");
    expect(sale.terminal.x121Origin).toBe("311088040001");
    expect(sale.fee.policyId).toBe("MERCHANT_POS_MERCHANT_PAYS");
    expect(sale.fee.amount).toBe(0.25);
    expect(sale.iso.responseCode).toBe("00");
    expect(sale.transcript).toContain("DIAL 8810");
    expect(sale.transcript).toContain("CONNECT OMNIBUCKS POS AUTHORIZATION");
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
      adminCaller.omnidat as unknown as {
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
    const orderProcedure = (adminCaller.omnidat as { createFoodOrder?: unknown })
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
    const operations = await adminCaller.omnidat.operations();

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
      db: withRoles(
        { insert: vi.fn(() => ({ values })) },
        "user-admin",
        ["admin"],
      ),
      ...OPERATOR_SESSION,
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
      adminCaller.omnidat as { stampActivityPassport?: unknown }
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
    const operations = await adminCaller.omnidat.operations();
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
      db: withRoles(
        { insert: vi.fn(() => ({ values })) },
        "user-admin",
        ["admin"],
      ),
      ...OPERATOR_SESSION,
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
    const db = withRoles(
      { insert: vi.fn(() => ({ values })) },
      "user-admin",
      ["admin"],
    );
    const persistentCaller = appRouter.createCaller({
      db,
      ...OPERATOR_SESSION,
    } as never);

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
            profile: "XOT HOST omnidat.cc\nCALL 311088029999",
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
    rowsByTable.set(omnidatOperatorRole, [
      { userId: "user-admin", role: "admin", active: true },
    ]);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async (table: unknown) => rowsByTable.get(table) ?? []),
      })),
    };
    const persistentCaller = appRouter.createCaller({
      db,
      session: { user: { id: "user-admin" } },
    } as never);

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

describe("omnidat sync and authority procedures", () => {
  const SYNC_TOKEN = "field-kit-secret";
  const EVENT_ID = "event-sync-1";

  function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  function createSyncFakeDb() {
    const tables = new Map<unknown, Array<Record<string, unknown>>>();
    const writes: Array<{ table: unknown; value: Record<string, unknown> }> = [];
    let id = 0;
    const rowsFor = (table: unknown) => {
      const existing = tables.get(table);
      if (existing) return existing;
      const created: Array<Record<string, unknown>> = [];
      tables.set(table, created);
      return created;
    };
    // Seed an operator role so gated read queries (dashboard/noc) pass when
    // this fake db backs an operator-session caller.
    rowsFor(omnidatOperatorRole).push({
      userId: "user-admin",
      role: "admin",
      active: true,
    });
    const returning = async () => [{ id: `row-${++id}` }];
    const db = {
      insert: (table: unknown) => ({
        values: (value: unknown) => {
          writes.push({ table, value: value as Record<string, unknown> });
          rowsFor(table).push(value as Record<string, unknown>);
          return { onConflictDoUpdate: () => ({ returning }), returning };
        },
      }),
      select: () => ({
        from: async (table: unknown) => rowsFor(table),
      }),
      update: (table: unknown) => ({
        set: (value: unknown) => ({
          where: () => {
            for (const row of rowsFor(table)) {
              Object.assign(row, value as Record<string, unknown>);
            }
            return Promise.resolve();
          },
        }),
      }),
    };
    rowsFor(omnidatSyncSource).push({
      id: "sync-1",
      sourceId: "field-kit-01",
      sourceKind: "field-kit",
      tokenHash: sha256(SYNC_TOKEN),
      lastPushedSeq: 0,
      lastSyncAt: null,
      active: true,
    });
    rowsFor(omnidatEventAuthority).push({
      id: "auth-1",
      eventId: EVENT_ID,
      epoch: 1,
      holder: "field",
      holderSourceId: "field-kit-01",
      fenceSeq: null,
    });
    return { db, writes, rowsFor };
  }

  function makeSyncEntry(seq: number, overrides?: Record<string, unknown>) {
    const payload = { note: `field op ${seq}` };
    return {
      seq,
      eventId: EVENT_ID,
      epoch: 1,
      opType: "campsite.note.filed",
      payload,
      idempotencyKey: `field-kit-01:${seq}`,
      payloadChecksum: journalPayloadChecksum(payload),
      recordedAt: "2026-07-04T18:00:00Z",
      ...overrides,
    };
  }

  beforeEach(() => {
    process.env.OMNIDAT_PERSISTENCE = "database";
  });

  it("syncPush applies a batch and returns a reconciliation report", async () => {
    const fake = createSyncFakeDb();
    const syncCaller = appRouter.createCaller({ db: fake.db } as never);

    const report = await syncCaller.omnidat.syncPush({
      sourceId: "field-kit-01",
      syncToken: SYNC_TOKEN,
      entries: [makeSyncEntry(1), makeSyncEntry(2)],
    });

    expect(report.applied).toBe(2);
    expect(report.duplicate).toBe(0);
    expect(report.rejectedStale).toBe(0);
    expect(report.highWatermark).toBe(2);
    expect(report.authority).toEqual({ holder: "field", epoch: 1 });
  });

  it("syncPush rejects a bad sync token", async () => {
    const fake = createSyncFakeDb();
    const syncCaller = appRouter.createCaller({ db: fake.db } as never);

    await expect(
      syncCaller.omnidat.syncPush({
        sourceId: "field-kit-01",
        syncToken: "wrong-token",
        entries: [makeSyncEntry(1)],
      }),
    ).rejects.toThrow(/token/i);
    expect(fake.rowsFor(omnidatJournalEntry)).toHaveLength(0);
  });

  it("syncPull returns entries above the supplied watermarks plus authority", async () => {
    const fake = createSyncFakeDb();
    fake.rowsFor(omnidatJournalEntry).push(
      {
        sourceId: "cloud",
        seq: 1,
        eventId: EVENT_ID,
        epoch: 1,
        opType: "service.approved",
        payload: { slug: "bulletin" },
        idempotencyKey: "cloud:1",
        payloadChecksum: "abc",
        recordedAt: new Date("2026-07-04T17:00:00Z"),
        applyStatus: "applied",
      },
      {
        sourceId: "cloud",
        seq: 2,
        eventId: EVENT_ID,
        epoch: 1,
        opType: "service.approved",
        payload: { slug: "queue" },
        idempotencyKey: "cloud:2",
        payloadChecksum: "def",
        recordedAt: new Date("2026-07-04T17:05:00Z"),
        applyStatus: "applied",
      },
    );
    const syncCaller = appRouter.createCaller({ db: fake.db } as never);

    const all = await syncCaller.omnidat.syncPull({
      sourceId: "field-kit-01",
      syncToken: SYNC_TOKEN,
      eventId: EVENT_ID,
      watermarks: {},
    });
    const tail = await syncCaller.omnidat.syncPull({
      sourceId: "field-kit-01",
      syncToken: SYNC_TOKEN,
      eventId: EVENT_ID,
      watermarks: { cloud: 1 },
    });

    expect(all.entries.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(tail.entries.map((entry) => entry.seq)).toEqual([2]);
    expect(tail.authority).toMatchObject({ holder: "field", epoch: 1 });
  });

  it("authorityStatus reports holder, epoch, and per-source sync recency", async () => {
    const fake = createSyncFakeDb();
    const syncCaller = appRouter.createCaller({ db: fake.db } as never);

    await syncCaller.omnidat.syncPush({
      sourceId: "field-kit-01",
      syncToken: SYNC_TOKEN,
      entries: [makeSyncEntry(1)],
    });
    const status = await syncCaller.omnidat.authorityStatus({
      eventId: EVENT_ID,
    });

    expect(status.authority).toMatchObject({ holder: "field", epoch: 1 });
    const source = status.sources.find(
      (entry) => entry.sourceId === "field-kit-01",
    );
    expect(source?.lastPushedSeq).toBe(1);
    expect(source?.lastSyncAt).toBeTruthy();
  });

  it("transferAuthority increments the epoch, records the fence, and audits", async () => {
    const fake = createSyncFakeDb();
    const syncCaller = appRouter.createCaller({
      db: fake.db,
      session: { user: { id: "user-admin" } },
    } as never);

    await syncCaller.omnidat.syncPush({
      sourceId: "field-kit-01",
      syncToken: SYNC_TOKEN,
      entries: [makeSyncEntry(1), makeSyncEntry(2)],
    });
    const transfer = await syncCaller.omnidat.transferAuthority({
      eventId: EVENT_ID,
      toHolder: "cloud",
      toSourceId: "cloud",
      reason: "field kit unreachable",
    });

    expect(transfer.epoch).toBe(2);
    expect(transfer.holder).toBe("cloud");
    expect(transfer.fenceSeq).toBe(2);

    const auditWrites = fake.writes.filter(
      (write) =>
        write.table === omnidatAuditEvent &&
        write.value.eventType === "authority.transferred",
    );
    expect(auditWrites).toHaveLength(1);
    expect(
      (auditWrites[0]?.value.details as Record<string, unknown>).operatorId,
    ).toBe("user-admin");
    expect(
      (auditWrites[0]?.value.details as Record<string, unknown>).reason,
    ).toBe("field kit unreachable");
  });

  it("dashboard and noc expose sync staleness when a field kit holds authority", async () => {
    const fake = createSyncFakeDb();
    const syncSourceRow = fake.rowsFor(omnidatSyncSource)[0];
    if (syncSourceRow) {
      syncSourceRow.lastSyncAt = new Date("2026-07-04T14:00:00Z");
      syncSourceRow.lastPushedSeq = 7;
    }
    const syncCaller = appRouter.createCaller({
      db: fake.db,
      session: { user: { id: "user-admin" } },
    } as never);

    const dashboard = await syncCaller.omnidat.dashboard({
      eventId: EVENT_ID,
      now: "2026-07-04T14:06:00Z",
    });
    const noc = await syncCaller.omnidat.noc({
      eventId: EVENT_ID,
      now: "2026-07-04T14:06:00Z",
    });

    expect(dashboard.sync).toMatchObject({
      holder: "field",
      epoch: 1,
      sourceId: "field-kit-01",
      stalenessSeconds: 360,
    });
    expect(noc.sync?.holder).toBe("field");
    expect(noc.sync?.stalenessSeconds).toBe(360);
  });

  it("dashboard sync reports cloud authority when no field kit is registered", async () => {
    const fake = createSyncFakeDb();
    fake.rowsFor(omnidatSyncSource).length = 0;
    fake.rowsFor(omnidatEventAuthority).length = 0;
    const syncCaller = appRouter.createCaller({
      db: fake.db,
      session: { user: { id: "user-admin" } },
    } as never);

    const dashboard = await syncCaller.omnidat.dashboard({ eventId: EVENT_ID });

    expect(dashboard.sync).toMatchObject({ holder: "cloud", epoch: 0 });
    expect(dashboard.sync?.sourceId).toBeNull();
  });

  it("registerSyncSource issues a one-time token and lists the source", async () => {
    const fake = createSyncFakeDb();
    // Start without field-kit-01 so registration is a create, not only rotate.
    fake.rowsFor(omnidatSyncSource).length = 0;
    const syncCaller = appRouter.createCaller({
      db: fake.db,
      session: { user: { id: "user-admin" } },
    } as never);

    const registered = await syncCaller.omnidat.registerSyncSource({
      sourceId: "field-kit-rehearsal",
      sourceKind: "field-kit",
    });
    expect(registered.sourceId).toBe("field-kit-rehearsal");
    expect(registered.syncToken.length).toBeGreaterThan(16);
    expect(registered.rotated).toBe(false);

    const status = await syncCaller.omnidat.authorityStatus({
      eventId: EVENT_ID,
    });
    expect(
      status.sources.some((s) => s.sourceId === "field-kit-rehearsal"),
    ).toBe(true);

    // Token must authenticate syncPush.
    await expect(
      syncCaller.omnidat.syncPush({
        sourceId: "field-kit-rehearsal",
        syncToken: registered.syncToken,
        entries: [],
      }),
    ).resolves.toBeTruthy();
  });

  it("transferAuthority refuses a target that has not caught up", async () => {
    const fake = createSyncFakeDb();
    // Cloud holds authority (epoch 2) and has journaled past the kit's view.
    fake.rowsFor(omnidatEventAuthority).push({
      id: "auth-2",
      eventId: EVENT_ID,
      epoch: 2,
      holder: "cloud",
      holderSourceId: "cloud",
      fenceSeq: 0,
    });
    fake.rowsFor(omnidatJournalEntry).push({
      sourceId: "cloud",
      seq: 3,
      eventId: EVENT_ID,
      epoch: 2,
      opType: "service.approved",
      payload: {},
      idempotencyKey: "cloud:3",
      payloadChecksum: "abc",
      recordedAt: new Date(),
      applyStatus: "applied",
    });
    const syncCaller = appRouter.createCaller({
      db: fake.db,
      session: { user: { id: "user-admin" } },
    } as never);

    await expect(
      syncCaller.omnidat.transferAuthority({
        eventId: EVENT_ID,
        toHolder: "field",
        toSourceId: "field-kit-01",
        reason: "kit recovered",
        targetWatermarks: { cloud: 2 },
      }),
    ).rejects.toThrow(/caught up|watermark/i);

    const accepted = await syncCaller.omnidat.transferAuthority({
      eventId: EVENT_ID,
      toHolder: "field",
      toSourceId: "field-kit-01",
      reason: "kit recovered",
      targetWatermarks: { cloud: 3 },
    });
    expect(accepted.epoch).toBe(3);
    expect(accepted.holder).toBe("field");
  });
});

describe("omnidat packet sessions", () => {
  function sessionFakeDb(userId: string, roles: string[]) {
    const rows: Record<string, unknown>[] = [];
    const writes: Array<{ table: unknown; value: Record<string, unknown> }> = [];
    let id = 0;
    return {
      rows,
      writes,
      db: {
        select: () => ({
          from: async (table: unknown) =>
            table === omnidatOperatorRole
              ? roles.map((role) => ({ userId, role, active: true }))
              : table === omnidatPacketSession
                ? rows
                : [],
        }),
        insert: (table: unknown) => ({
          values: (value: Record<string, unknown>) => {
            const withId = { id: `sess-${++id}`, ...value };
            writes.push({ table, value: withId });
            if (table === omnidatPacketSession) rows.push(withId);
            return {
              onConflictDoUpdate: () => ({ returning: async () => [withId] }),
              returning: async () => [withId],
            };
          },
        }),
        update: (table: unknown) => ({
          set: (value: Record<string, unknown>) => ({
            where: () => {
              if (table === omnidatPacketSession) {
                for (const row of rows) Object.assign(row, value);
              }
              return Promise.resolve();
            },
          }),
        }),
      },
    };
  }

  function caller(fake: ReturnType<typeof sessionFakeDb>) {
    return appRouter.createCaller({
      db: fake.db,
      session: { user: { id: "user-packet-operator" } },
    } as never);
  }

  beforeEach(() => {
    process.env.OMNIDAT_PERSISTENCE = "database";
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("opens a packet session and audits session.opened", async () => {
    const fake = sessionFakeDb("user-packet-operator", ["packet-operator"]);
    const opened = await caller(fake).omnidat.openPacketSession({
      sourceIdentity: "camp-oscillator-terminal",
      sourceTransport: "xot",
      destinationX121: "311088020184",
    });

    expect(opened.status).toBe("connected");
    expect(
      fake.writes.some(
        (w) =>
          w.table === omnidatAuditEvent &&
          w.value.eventType === "session.opened",
      ),
    ).toBe(true);
  });

  it("clears a session with honest X.25 cause and diagnostic code points", async () => {
    const fake = sessionFakeDb("user-packet-operator", ["packet-operator"]);
    const opened = await caller(fake).omnidat.openPacketSession({
      sourceIdentity: "camp-oscillator-terminal",
      sourceTransport: "xot",
      destinationX121: "311088020184",
    });
    const cleared = await caller(fake).omnidat.clearPacketSession({
      sessionId: opened.id,
      clearCause: 0,
      clearDiagnostic: 0,
      transcript: "CALL 311088020184\nCLR DTE C:0",
    });

    expect(cleared.clearCause).toBe(0);
    expect(cleared.clearDiagnostic).toBe(0);
    expect(cleared.transcriptHash).toHaveLength(64);
    expect(cleared.status).toBe("cleared");
    expect(
      fake.writes.some(
        (w) =>
          w.table === omnidatAuditEvent &&
          w.value.eventType === "session.cleared",
      ),
    ).toBe(true);
  });

  it("lists active and recently cleared sessions for NOC visibility", async () => {
    const fake = sessionFakeDb("user-packet-operator", ["packet-operator"]);
    await caller(fake).omnidat.openPacketSession({
      sourceIdentity: "camp-a",
      sourceTransport: "xot",
      destinationX121: "311088020184",
    });
    const sessions = await caller(fake).omnidat.listPacketSessions();
    expect(sessions.sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.sessions[0]?.destinationX121).toBe("311088020184");
  });

  it("openPacketSession requires session.write (auditor forbidden)", async () => {
    const fake = sessionFakeDb("user-auditor", ["auditor"]);
    await expect(
      appRouter
        .createCaller({
          db: fake.db,
          session: { user: { id: "user-auditor" } },
        } as never)
        .omnidat.openPacketSession({
          sourceIdentity: "camp-a",
          sourceTransport: "xot",
          destinationX121: "311088020184",
        }),
    ).rejects.toThrow(/operator role required/i);
  });
});

describe("omnidat evidence and service verbs", () => {
  function captureDb(userId: string, roles: string[]) {
    const writes: Array<{ table: unknown; value: Record<string, unknown> }> = [];
    const rows: Record<string, unknown>[] = [];
    let id = 0;
    return {
      writes,
      rows,
      db: {
        select: () => ({
          from: async (table: unknown) =>
            table === omnidatOperatorRole
              ? roles.map((role) => ({ userId, role, active: true }))
              : table === omnidatEvidenceArtifact
                ? rows
                : [],
        }),
        insert: (table: unknown) => ({
          values: (value: Record<string, unknown>) => {
            const withId = { id: `row-${++id}`, ...value };
            writes.push({ table, value: withId });
            if (table === omnidatEvidenceArtifact) rows.push(withId);
            return {
              onConflictDoUpdate: () => ({ returning: async () => [withId] }),
              returning: async () => [withId],
            };
          },
        }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      },
    };
  }
  function opCaller(fake: ReturnType<typeof captureDb>, userId: string) {
    return appRouter.createCaller({
      db: fake.db,
      session: { user: { id: userId } },
    } as never);
  }

  beforeEach(() => {
    process.env.OMNIDAT_PERSISTENCE = "database";
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("creates and lists evidence artifacts (evidence.write / operator.read)", async () => {
    const fake = captureDb("user-packet", ["packet-operator"]);
    const created = await opCaller(fake, "user-packet").omnidat.createEvidenceArtifact({
      artifactKind: "session-transcript",
      label: "Camp A terminal transcript",
      url: "/evidence/camp-a.txt",
      recordCount: 1,
    });
    expect(created.artifactKind).toBe("session-transcript");
    expect(
      fake.writes.some(
        (w) => w.table === omnidatAuditEvent && w.value.eventType === "evidence.created",
      ),
    ).toBe(true);

    const listed = await opCaller(fake, "user-packet").omnidat.listEvidenceArtifacts();
    expect(listed.artifacts[0]?.label).toBe("Camp A terminal transcript");
  });

  it("upserts and disables service verbs (verb.write)", async () => {
    const fake = captureDb("user-packet", ["packet-operator"]);
    await opCaller(fake, "user-packet").omnidat.upsertServiceVerb({
      serviceId: "service-1",
      verb: "POST",
      inputs: ["body"],
      outputs: ["messageId"],
    });
    expect(
      fake.writes.some(
        (w) => w.table === omnidatAuditEvent && w.value.eventType === "verb.upserted",
      ),
    ).toBe(true);

    await opCaller(fake, "user-packet").omnidat.disableServiceVerb({
      serviceId: "service-1",
      verb: "POST",
    });
    expect(
      fake.writes.some(
        (w) => w.table === omnidatAuditEvent && w.value.eventType === "verb.disabled",
      ),
    ).toBe(true);
  });

  it("forbids evidence and verb writes for auditor", async () => {
    const fake = captureDb("user-auditor", ["auditor"]);
    await expect(
      opCaller(fake, "user-auditor").omnidat.createEvidenceArtifact({
        artifactKind: "x",
        label: "y",
        url: "z",
      }),
    ).rejects.toThrow(/operator role required/i);
  });
});

describe("omnidat H1b operator CRUD", () => {
  function crudDb(userId: string, roles: string[]) {
    const writes: Array<{ table: unknown; value: Record<string, unknown> }> = [];
    const byTable = new Map<unknown, Record<string, unknown>[]>();
    let id = 0;
    const rowsFor = (t: unknown) => {
      const r = byTable.get(t) ?? [];
      byTable.set(t, r);
      return r;
    };
    return {
      writes,
      rowsFor,
      db: {
        select: () => ({
          from: async (t: unknown) =>
            t === omnidatOperatorRole
              ? roles.map((role) => ({ userId, role, active: true }))
              : rowsFor(t),
        }),
        insert: (t: unknown) => ({
          values: (v: Record<string, unknown>) => {
            const withId = { id: `h1b-${++id}`, ...v };
            writes.push({ table: t, value: withId });
            rowsFor(t).push(withId);
            return {
              onConflictDoUpdate: () => ({ returning: async () => [withId] }),
              returning: async () => [withId],
            };
          },
        }),
        update: (t: unknown) => ({
          set: (v: Record<string, unknown>) => ({
            where: () => {
              for (const row of rowsFor(t)) Object.assign(row, v);
              return Promise.resolve();
            },
          }),
        }),
      },
    };
  }
  const call = (fake: ReturnType<typeof crudDb>, userId: string) =>
    appRouter.createCaller({ db: fake.db, session: { user: { id: userId } } } as never);

  beforeEach(() => {
    process.env.OMNIDAT_PERSISTENCE = "database";
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("creates, lists, and re-statuses an event (admin only)", async () => {
    const fake = crudDb("user-admin", ["admin"]);
    const event = await call(fake, "user-admin").omnidat.createEvent({
      eventCode: "TOORCAMP-2028",
      displayName: "ToorCamp 2028",
    });
    expect(
      fake.writes.some((w) => w.value.eventType === "event.created"),
    ).toBe(true);
    await call(fake, "user-admin").omnidat.updateEventStatus({
      eventId: event.id,
      status: "active",
    });
    const listed = await call(fake, "user-admin").omnidat.listEvents();
    expect(listed.events[0]?.status).toBe("active");
  });

  it("forbids event.write for a packet-operator", async () => {
    const fake = crudDb("user-packet", ["packet-operator"]);
    await expect(
      call(fake, "user-packet").omnidat.createEvent({
        eventCode: "X",
        displayName: "Y",
      }),
    ).rejects.toThrow(/operator role required/i);
  });

  it("creates and suspends a campsite (campsite.write)", async () => {
    const fake = crudDb("user-packet", ["packet-operator"]);
    const camp = await call(fake, "user-packet").omnidat.createCampsite({
      slug: "camp-oscillator",
      displayName: "Camp Oscillator",
      contactHandle: "osc@example.test",
    });
    await call(fake, "user-packet").omnidat.updateCampsiteStatus({
      campsiteId: camp.id,
      status: "suspended",
    });
    const listed = await call(fake, "user-packet").omnidat.listCampsites();
    expect(listed.campsites[0]?.status).toBe("suspended");
  });

  it("allocates, verifies, suspends, and revokes an X.121 address", async () => {
    const fake = crudDb("user-packet", ["packet-operator"]);
    const alloc = await call(fake, "user-packet").omnidat.allocateAddress({
      x121: "311088020777",
      assignedToKind: "service",
    });
    expect(alloc.status).toBe("reserved");
    expect(
      fake.writes.some((w) => w.value.eventType === "allocation.assigned"),
    ).toBe(true);
    expect(
      fake.writes.some((w) => w.table === omnidatNetworkMetric),
    ).toBe(true);

    for (const status of ["verified", "suspended", "revoked"] as const) {
      await call(fake, "user-packet").omnidat.updateAllocationStatus({
        allocationId: alloc.id,
        x121: "311088020777",
        status,
      });
    }
    const listed = await call(fake, "user-packet").omnidat.listAllocations();
    expect(listed.allocations[0]?.status).toBe("revoked");
  });

  it("forbids allocation writes for a bank-operator", async () => {
    const fake = crudDb("user-bank", ["bank-operator"]);
    await expect(
      call(fake, "user-bank").omnidat.allocateAddress({
        x121: "311088020778",
        assignedToKind: "service",
      }),
    ).rejects.toThrow(/operator role required/i);
  });
});

describe("omnidat H1b lifecycle, incidents, billing, roles, export", () => {
  function lcDb(userId: string, roles: string[]) {
    const writes: Array<{ table: unknown; value: Record<string, unknown> }> = [];
    const byTable = new Map<unknown, Record<string, unknown>[]>();
    let id = 0;
    const rowsFor = (t: unknown) => {
      const r = byTable.get(t) ?? [];
      byTable.set(t, r);
      return r;
    };
    return {
      writes,
      rowsFor,
      db: {
        select: () => ({
          from: async (t: unknown) =>
            t === omnidatOperatorRole
              ? roles.map((role) => ({ userId, role, active: true }))
              : rowsFor(t),
        }),
        insert: (t: unknown) => ({
          values: (v: Record<string, unknown>) => {
            const withId = { id: `lc-${++id}`, ...v };
            writes.push({ table: t, value: withId });
            rowsFor(t).push(withId);
            return {
              onConflictDoUpdate: () => ({ returning: async () => [withId] }),
              returning: async () => [withId],
            };
          },
        }),
        update: (t: unknown) => ({
          set: (v: Record<string, unknown>) => ({
            where: () => {
              for (const row of rowsFor(t)) Object.assign(row, v);
              return Promise.resolve();
            },
          }),
        }),
      },
    };
  }
  const call = (fake: ReturnType<typeof lcDb>, userId: string) =>
    appRouter.createCaller({ db: fake.db, session: { user: { id: userId } } } as never);

  beforeEach(() => {
    process.env.OMNIDAT_PERSISTENCE = "database";
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("runs the provisioning lifecycle and rejects illegal jumps", async () => {
    const fake = lcDb("user-packet", ["packet-operator"]);
    const req = await call(fake, "user-packet").omnidat.requestProvisioning({
      transport: "xot",
    });
    expect(req.status).toBe("requested");

    // legal path requested -> reviewed -> approved
    await call(fake, "user-packet").omnidat.advanceProvisioning({
      requestId: req.id,
      toStatus: "reviewed",
    });
    await call(fake, "user-packet").omnidat.advanceProvisioning({
      requestId: req.id,
      toStatus: "approved",
    });

    // illegal jump approved -> active (skips assigned/installed/verified)
    await expect(
      call(fake, "user-packet").omnidat.advanceProvisioning({
        requestId: req.id,
        toStatus: "active",
      }),
    ).rejects.toThrow(/illegal provisioning transition/i);

    // suspend is legal from any non-terminal state
    const suspended = await call(fake, "user-packet").omnidat.advanceProvisioning({
      requestId: req.id,
      toStatus: "suspended",
    });
    expect(suspended.status).toBe("suspended");
  });

  it("walks the full legal path requested → active with verification transcript", async () => {
    const fake = lcDb("user-packet", ["packet-operator"]);
    const req = await call(fake, "user-packet").omnidat.requestProvisioning({
      transport: "xot",
      requestedX121: "311088020501",
    });
    const steps = [
      "reviewed",
      "approved",
      "assigned",
      "installed",
      "verified",
      "active",
    ] as const;
    for (const toStatus of steps) {
      const advanced = await call(fake, "user-packet").omnidat.advanceProvisioning({
        requestId: req.id,
        toStatus,
        verificationTranscript:
          toStatus === "verified" ? "CALL 311088020501 CLR DTE C:0 D:0" : undefined,
      });
      expect(advanced.status).toBe(toStatus);
    }
    // terminal after active
    const revoked = await call(fake, "user-packet").omnidat.advanceProvisioning({
      requestId: req.id,
      toStatus: "revoked",
    });
    expect(revoked.status).toBe("revoked");
    await expect(
      call(fake, "user-packet").omnidat.advanceProvisioning({
        requestId: req.id,
        toStatus: "active",
      }),
    ).rejects.toThrow(/illegal provisioning transition/i);
  });

  it("opens and resolves an incident with a time-to-clear metric", async () => {
    const fake = lcDb("user-noc", ["noc-operator"]);
    const incident = await call(fake, "user-noc").omnidat.openIncident({
      title: "MeshCore gateway degraded",
      severity: "major",
    });
    expect(
      fake.writes.some((w) => w.value.eventType === "incident.opened"),
    ).toBe(true);
    await call(fake, "user-noc").omnidat.updateIncident({
      incidentId: incident.id,
      status: "resolved",
      timeToClearMinutes: 12,
    });
    const resolvedMetric = fake.writes.find(
      (w) => w.table === omnidatNetworkMetric && w.value.metricName === "incident.resolved",
    );
    expect(resolvedMetric?.value.value).toBe(12);
  });

  it("creates a billing account and sets a fee policy (bank.write)", async () => {
    const fake = lcDb("user-bank", ["bank-operator"]);
    const account = await call(fake, "user-bank").omnidat.createBillingAccount({
      externalAccountId: "SB-CAMP-001",
      accountType: "camp-operating",
      displayName: "Camp Oscillator",
    });
    await call(fake, "user-bank").omnidat.setFeePolicy({
      accountId: account.id,
      policyKind: "percentage",
      amount: 3,
    });
    expect(
      fake.writes.some((w) => w.value.eventType === "fee.policy.set"),
    ).toBe(true);
  });

  it("lists operator role grants for admin only, and exports evidence", async () => {
    const fake = lcDb("user-admin", ["admin"]);
    const roles = await call(fake, "user-admin").omnidat.listOperatorRoles();
    expect(roles.roles[0]?.role).toBe("admin");

    await call(fake, "user-admin").omnidat.exportEventEvidence({
      label: "ToorCamp 2028 export",
      url: "/evidence/toorcamp-2028.json",
      recordCount: 42,
    });
    expect(
      fake.writes.some((w) => w.value.eventType === "evidence.exported"),
    ).toBe(true);
  });

  it("forbids listOperatorRoles for non-admins", async () => {
    const fake = lcDb("user-noc", ["noc-operator"]);
    await expect(
      call(fake, "user-noc").omnidat.listOperatorRoles(),
    ).rejects.toThrow(/operator role required/i);
  });

  it("lists recent audit events for operators after a write", async () => {
    const fake = lcDb("user-admin", ["admin"]);
    await call(fake, "user-admin").omnidat.createEvent({
      eventCode: "AUDIT-CAMP",
      displayName: "Audit Camp",
    });
    // Seed an audit row the loader can see (createEvent audits via insert path).
    fake.rowsFor(omnidatAuditEvent).push({
      id: "audit-1",
      actorUserId: "user-admin",
      eventType: "event.created",
      subjectKind: "event",
      subjectId: "ev-1",
      details: { eventCode: "AUDIT-CAMP" },
      createdAt: new Date("2026-07-13T12:00:00Z"),
    });
    const listed = await call(fake, "user-admin").omnidat.listRecentAuditEvents({
      limit: 10,
    });
    expect(listed.events.length).toBeGreaterThan(0);
    expect(listed.events[0]?.eventType).toBe("event.created");
  });
});

describe("omnidat packetCall browser XOT bridge", () => {
  const sessionCaller = (roles: string[], userId = "user-packet") =>
    appRouter.createCaller({
      db: {
        select: () => ({
          from: async (t: unknown) =>
            t === omnidatOperatorRole
              ? roles.map((role) => ({ userId, role, active: true }))
              : [],
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: () => ({ returning: async () => [{ id: "sess-1" }] }),
            returning: async () => [{ id: "sess-1" }],
          }),
        }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      },
      session: { user: { id: userId } },
    } as never);

  beforeEach(() => {
    resetOmnidatOperationalState();
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("calls a provisioned service and clears with cause 0 plus a receipt", async () => {
    const result = await sessionCaller(["packet-operator"]).omnidat.packetCall({
      sourceIdentity: "camp-oscillator-terminal",
      destinationX121: "311088020501",
      verb: "CALL",
    });
    expect(result.clearCode.cause).toBe(0);
    expect(result.clearCode.rendered).toBe("CLR DTE C:0 D:0");
    expect(result.transcript).toContain("PAD> CALL 311088020501");
    expect(result.transcript).toContain("CLR DTE C:0 D:0");
    expect(result.receipt.title).toContain("TRANSCRIPT");
    // H2: every CALL leaves a NOC-visible evidence artifact linked to the session
    expect(result.evidence.artifactKind).toBe("packet-call-receipt");
    expect(result.evidence.url).toMatch(/^evidence:\/\/packet-call\//);
    expect(result.session.evidenceArtifactId).toBe(result.evidence.id);
  });

  it("clears an unknown address with cause 13, never a silent error", async () => {
    const result = await sessionCaller(["packet-operator"]).omnidat.packetCall({
      sourceIdentity: "camp-a",
      destinationX121: "311088099999",
    });
    expect(result.clearCode.cause).toBe(13);
    expect(result.clearCode.rendered).toBe("CLR NP C:13 D:67");
    expect(result.transcript).toContain("NO SUCH ADDRESS 311088099999");
    // Failure paths still leave evidence (honest clear + receipt)
    expect(result.evidence.artifactKind).toBe("packet-call-receipt");
    expect(result.session.evidenceArtifactId).toBe(result.evidence.id);
  });

  it("refuses an over-budget guest-radio call with an honest cause", async () => {
    const result = await sessionCaller(["packet-operator"]).omnidat.packetCall({
      sourceIdentity: "guest-radio",
      sourceTransport: "meshtastic",
      destinationX121: "311088020501",
      verb: "CALL",
      callUserData: "X".repeat(100),
    });
    expect(result.clearCode.cause).toBe(19);
    expect(result.transcript).toContain("EXCEEDS");
  });

  it("forbids packetCall for an auditor", async () => {
    await expect(
      sessionCaller(["auditor"], "user-auditor").omnidat.packetCall({
        sourceIdentity: "camp-a",
        destinationX121: "311088020501",
      }),
    ).rejects.toThrow(/operator role required/i);
  });

  it("VT100 serviceConnect leaves NOC session + packet-call evidence", async () => {
    const result = await sessionCaller(["packet-operator"]).omnidat.serviceConnect({
      x121: "311088020501",
      sourceIdentity: "vt100-operator",
      sourceTransport: "xot",
      sourceX121: "311088000001",
    });
    expect(result.ended).toBe(false);
    expect(result.session.destinationX121).toBe("311088020501");
    expect(result.session.status).toBe("open");
    expect(result.evidence.artifactKind).toBe("packet-call-receipt");
    expect(result.evidence.url).toMatch(/^evidence:\/\/packet-call\//);
    expect(result.session.evidenceArtifactId).toBe(result.evidence.id);
    expect(result.clearCode.cause).toBe(0);
  });

  it("VT100 serviceConnect clears unknown address with evidence", async () => {
    const result = await sessionCaller(["packet-operator"]).omnidat.serviceConnect({
      x121: "311088099999",
    });
    expect(result.ended).toBe(true);
    expect(result.session.status).toBe("cleared");
    expect(result.evidence.artifactKind).toBe("packet-call-receipt");
    expect(result.clearCode.cause).toBe(13);
  });
});

describe("omnidat H3 camp utility apps", () => {
  function appDb(userId: string, roles: string[]) {
    const writes: Array<{ table: unknown; value: Record<string, unknown> }> = [];
    const byTable = new Map<unknown, Record<string, unknown>[]>();
    let id = 0;
    const rowsFor = (t: unknown) => {
      const r = byTable.get(t) ?? [];
      byTable.set(t, r);
      return r;
    };
    return {
      writes,
      db: {
        select: () => ({
          from: async (t: unknown) =>
            t === omnidatOperatorRole
              ? roles.map((role) => ({ userId, role, active: true }))
              : rowsFor(t),
        }),
        insert: (t: unknown) => ({
          values: (v: Record<string, unknown>) => {
            const withId = { id: `app-${++id}`, ...v };
            writes.push({ table: t, value: withId });
            rowsFor(t).push(withId);
            return {
              onConflictDoUpdate: () => ({ returning: async () => [withId] }),
              returning: async () => [withId],
            };
          },
        }),
        update: (t: unknown) => ({
          set: (v: Record<string, unknown>) => ({
            where: () => {
              for (const row of rowsFor(t)) Object.assign(row, v);
              return Promise.resolve();
            },
          }),
        }),
      },
    };
  }
  const call = (fake: ReturnType<typeof appDb>, userId: string) =>
    appRouter.createCaller({ db: fake.db, session: { user: { id: userId } } } as never);

  beforeEach(() => {
    process.env.OMNIDAT_PERSISTENCE = "database";
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("configures several campsite app kinds without code changes and delists one", async () => {
    const fake = appDb("user-packet", ["packet-operator"]);
    const kinds = ["bulletin", "message-desk", "lost-property", "classifieds", "form-intake"] as const;
    const created = [];
    for (const [index, appKind] of kinds.entries()) {
      created.push(
        await call(fake, "user-packet").omnidat.createCampsiteApp({
          campsiteId: "camp-1",
          address: `31108802${1000 + index}`,
          name: `${appKind} desk`,
          appKind,
        }),
      );
    }
    const listed = await call(fake, "user-packet").omnidat.listCampsiteApps();
    expect(listed.apps.length).toBe(5);
    expect(listed.kinds.length).toBeGreaterThanOrEqual(5);

    await call(fake, "user-packet").omnidat.updateCampsiteAppStatus({
      appId: created[0]!.id,
      status: "delisted",
    });
    expect(
      fake.writes.some((w) => w.value.eventType === "campsite.app.status.changed"),
    ).toBe(true);
  });

  it("rejects an unknown app kind", async () => {
    const fake = appDb("user-packet", ["packet-operator"]);
    const badInput = {
      campsiteId: "camp-1",
      address: "311088021999",
      name: "bad app",
      appKind: "not-a-real-kind",
    } as unknown as Parameters<
      ReturnType<typeof call>["omnidat"]["createCampsiteApp"]
    >[0];
    await expect(
      call(fake, "user-packet").omnidat.createCampsiteApp(badInput),
    ).rejects.toThrow();
  });

  it("forbids campsite app writes for an auditor", async () => {
    const fake = appDb("user-auditor", ["auditor"]);
    await expect(
      call(fake, "user-auditor").omnidat.createCampsiteApp({
        campsiteId: "camp-1",
        address: "311088021000",
        name: "bulletin",
        appKind: "bulletin",
      }),
    ).rejects.toThrow(/operator role required/i);
  });
});

describe("omnidat H4 POS batch close", () => {
  function bankDb(userId: string, roles: string[]) {
    const writes: Array<{ table: unknown; value: Record<string, unknown> }> = [];
    return {
      writes,
      db: {
        select: () => ({
          from: async (t: unknown) =>
            t === omnidatOperatorRole
              ? roles.map((role) => ({ userId, role, active: true }))
              : [],
        }),
        insert: (t: unknown) => ({
          values: (v: Record<string, unknown>) => {
            writes.push({ table: t, value: v });
            return { onConflictDoUpdate: () => ({}), returning: async () => [{ id: "x" }] };
          },
        }),
      },
    };
  }
  const call = (fake: ReturnType<typeof bankDb>, userId: string) =>
    appRouter.createCaller({ db: fake.db, session: { user: { id: userId } } } as never);

  beforeEach(() => {
    process.env.OMNIDAT_PERSISTENCE = "database";
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("closes a POS batch into a reconciled settlement report", async () => {
    const fake = bankDb("user-bank", ["bank-operator"]);
    const result = await call(fake, "user-bank").omnidat.posBatchClose({
      terminalId: "VF-NITEMARKT-01",
      batchId: "BATCH-001",
      transactions: [
        { kind: "sale", amount: 1400, reference: "RRN-1" },
        { kind: "refund", amount: 200, reference: "RRN-2" },
      ],
    });
    expect(result.report.net).toBe(1200);
    expect(result.receipt).toContain("SETTLEMENT REPORT");
    expect(
      fake.writes.some((w) => w.value.eventType === "pos.batch.closed"),
    ).toBe(true);
  });

  it("forbids POS batch close for a packet-operator", async () => {
    const fake = bankDb("user-packet", ["packet-operator"]);
    await expect(
      call(fake, "user-packet").omnidat.posBatchClose({
        terminalId: "VF-1",
        batchId: "B-1",
        transactions: [],
      }),
    ).rejects.toThrow(/operator role required/i);
  });
});
