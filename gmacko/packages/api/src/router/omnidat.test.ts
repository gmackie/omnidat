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

    const provisioned = await persistentCaller.omnidat.provisionCampsiteService({
      campsiteName: "Camp Durable",
      namespace: "camp",
      contact: "durable@example.test",
      appName: "Durable Bulletin",
      appKind: "message-board",
      transport: "wifi",
    });
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
});
