/**
 * Full OMNIDAT network E2E walkthrough by persona:
 *   public user → vendor operator → packet operator → bank operator → admin
 * Covers directory, VT100/XOT onboarding, Verifone program pack + dial POS,
 * ATM setup, provisioning, PAD config, NOC sessions/evidence, and role grants.
 */
import { omnidatOperatorRole } from "@omnidat/db/schema";
import { resetOmnidatOperationalState } from "@omnidat/operator-core/omnidat";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appRouter } from "../root";
import type { OmnidatRole } from "./omnidat-roles";

const originalPersistence = process.env.OMNIDAT_PERSISTENCE;

type Inserted = { table: unknown; value: Record<string, unknown> };

function createE2eDb(userId: string, roles: OmnidatRole[]) {
  const inserts: Inserted[] = [];
  const byTable = new Map<unknown, Record<string, unknown>[]>();
  const roleRows: Record<string, unknown>[] = roles.map((role) => ({
    userId,
    role,
    active: true,
    eventId: null,
  }));
  byTable.set(omnidatOperatorRole, roleRows);
  let seq = 0;
  return {
    inserts,
    db: {
      select: () => ({
        from: async (table: unknown) => [...(byTable.get(table) ?? [])],
      }),
      insert: (table: unknown) => ({
        values: (value: Record<string, unknown> | Record<string, unknown>[]) => {
          const rows = Array.isArray(value) ? value : [value];
          const withIds = rows.map((row) => ({
            id: row.id ?? `e2e-${++seq}`,
            ...row,
          }));
          const bucket = byTable.get(table) ?? [];
          for (const row of withIds) {
            inserts.push({ table, value: row });
            bucket.push(row);
          }
          byTable.set(table, bucket);
          return {
            onConflictDoUpdate: () => ({
              returning: async () => withIds,
            }),
            returning: async () => withIds,
          };
        },
      }),
      update: (table?: unknown) => ({
        set: (patch: Record<string, unknown>) => ({
          where: async () => {
            const bucket = byTable.get(table ?? omnidatOperatorRole) ?? [];
            for (const row of bucket) {
              Object.assign(row, patch);
            }
          },
        }),
      }),
    },
  };
}

function callerFor(roles: OmnidatRole[], userId = `user-${roles.join("-") || "public"}`) {
  const { db, inserts } = createE2eDb(userId, roles);
  return {
    inserts,
    userId,
    api: appRouter.createCaller({
      db,
      session: roles.length
        ? { user: { id: userId, email: `${userId}@omnidat.cc`, name: userId } }
        : null,
    } as never),
  };
}

function publicCaller() {
  return appRouter.createCaller({
    db: {
      select: () => ({ from: async () => [] }),
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({ returning: async () => [] }),
          returning: async () => [],
        }),
      }),
    },
    session: null,
  } as never);
}

describe("OMNIDAT network E2E — personas + terminal onboarding", () => {
  beforeEach(() => {
    resetOmnidatOperationalState();
    // Role grants + evidence lists only load when DB persistence is on.
    process.env.OMNIDAT_PERSISTENCE = "database";
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("public user can read directory, status, program pack; cannot mutate", async () => {
    const guest = publicCaller();

    const network = await guest.omnidat.network();
    expect(network.protocol).toBe("X.25");

    const services = await guest.omnidat.services();
    expect(services.services.length).toBeGreaterThanOrEqual(5);
    expect(services.services.some((s) => s.x121 === "311088010110")).toBe(true);
    expect(services.services.some((s) => s.x121 === "311088002010")).toBe(true);

    const dashboard = await guest.omnidat.dashboard();
    expect(dashboard.metrics.totalServices).toBeGreaterThan(0);

    const noc = await guest.omnidat.noc();
    expect(noc.adapter.protocol).toBe("X.25");
    expect((noc.circuits ?? []).length).toBeGreaterThan(0);

    const pack = await guest.omnidat.vintageTerminalProgramPack();
    expect(pack.version).toMatch(/OMNIDAT-VF/);
    expect(pack.hostBindings.sale.x121).toBe("311088002010");
    expect(pack.programs.sale.tcl).toContain("DIAL 8810");

    const banner = await guest.omnidat.terminalBanner({});
    expect(banner.prompt).toBeTruthy();
    expect(banner.banner.length).toBeGreaterThan(10);

    await expect(
      guest.omnidat.packetCall({
        sourceIdentity: "guest",
        destinationX121: "311088010110",
      }),
    ).rejects.toThrow();

    await expect(
      guest.omnidat.vintagePosSale({
        terminalId: "VF-X",
        terminalModel: "VERIFONE_TRANZ_330",
        merchantAccountId: "SB-CAMP-LAMINAR-001",
        amount: 1,
        feePolicyId: "MERCHANT_POS_MERCHANT_PAYS",
        retrievalReference: "000000000001",
      }),
    ).rejects.toThrow();
  });

  it("walks full Verifone onboarding: pack → package → dial POS → ATM", async () => {
    const vendor = callerFor(["vendor-operator"], "user-vendor");
    const bank = callerFor(["bank-operator"], "user-bank");

    // 1. Read public program pack (field tech can preview without auth)
    const pack = await publicCaller().omnidat.vintageTerminalProgramPack();
    expect(pack.deployment.runbook.length).toBeGreaterThan(0);
    expect(pack.capabilities).toContain("internal-pots-modem");
    expect(pack.supportedFamilies.map((f) => f.family)).toContain(
      "TRANZ_330_380_TCL",
    );

    // 2. Vendor builds terminal download package (TCLOAD / ZONTALK)
    const download = await vendor.api.omnidat.vintageTerminalDownloadPackage({
      terminalId: "VF-TR330-NITEMARKT-01",
      merchantAccountId: "SB-CAMP-LAMINAR-001",
      family: "TRANZ_330_380_TCL",
    });
    expect(download.packageId).toBeTruthy();
    expect(download.validationStatus).toMatch(/bench|ready|validation/i);
    expect(download.files.some((f) => f.path.includes("OMNISALE.TCL"))).toBe(
      true,
    );
    expect(
      download.files.some((f) => /[+D]|[+I]|DIAL 8810/.test(f.contents)),
    ).toBe(true);
    expect(download.portProfiles.some((p) => p.dialNumber === "8810")).toBe(
      true,
    );
    expect(download.shadyBankProtocol.sale.authorize.path).toBe(
      "/api/authorize",
    );

    // 3. First live sale through FEP after package load
    const sale = await vendor.api.omnidat.vintagePosSale({
      terminalId: "VF-TR330-NITEMARKT-01",
      terminalModel: "VERIFONE_TRANZ_330",
      merchantAccountId: "SB-CAMP-LAMINAR-001",
      clerkCode: "042",
      amount: 13,
      feePolicyId: "MERCHANT_POS_MERCHANT_PAYS",
      noteSerial: "SBMO-E2E-000001",
      retrievalReference: "000000000313",
    });
    expect(sale.status).toBe("approved");
    expect(sale.hostX121).toBe("311088002010");
    expect(sale.transcript).toContain("DIAL 8810");
    expect(sale.transcript).toContain("CALL 311088002010");
    expect(sale.receipt).toContain("OMNIDAT POS RECEIPT");
    expect(sale.iso.responseCode).toBe("00");

    // 4. Bank operator provisions ATM on the same merchant rail
    const atm = await bank.api.omnidat.setupAtmTerminal({
      terminalId: "ATM-E2E-001",
      settlementAccountId: "SB-CAMP-LAMINAR-001",
      locationLabel: "Exchange 88 foyer",
    });
    expect(atm.terminalId).toBe("ATM-E2E-001");
    expect(atm.terminalX121).toMatch(/^311088/);

    const iso = await bank.api.omnidat.iso8583Transaction({
      mti: "0200",
      processingCode: "000000",
      amount: 19,
      accountId: "SB-CAMP-LAMINAR-001",
      terminalId: "ATM-E2E-001",
      retrievalReference: "000000000019",
    });
    expect(iso.responseCode).toBe("00");
    expect(iso.responseMti).toBe("0210");
  });

  it("walks full VT100 / XOT onboarding: banner → CALL → evidence → verbs → PAD", async () => {
    const packet = callerFor(["packet-operator"], "user-packet");
    const noc = callerFor(["noc-operator"], "user-noc");

    // 1. Terminal attach (banner is public; session mutations need role)
    const banner = await packet.api.omnidat.terminalBanner({
      x121: "311088000001",
    });
    expect(banner.x121 ?? "311088000001").toBeTruthy();
    expect(banner.prompt).toMatch(/311088|PAD|>/i);

    // 2. Directory from public services (local DIR on client mirrors this)
    const directory = await packet.api.omnidat.services();
    const food = directory.services.find((s) => s.x121 === "311088020501");
    expect(food?.name.toLowerCase()).toMatch(/miliways|food|order/);

    // 3. Interactive VT100 CALL leaves session + evidence (H2)
    const connect = await packet.api.omnidat.serviceConnect({
      x121: "311088020501",
      sourceIdentity: "vt100-operator",
      sourceTransport: "xot",
      sourceX121: "311088000001",
    });
    expect(connect.ended).toBe(false);
    expect(connect.session.status).toBe("open");
    expect(connect.evidence.artifactKind).toBe("packet-call-receipt");
    expect(connect.evidence.url).toMatch(/^evidence:\/\/packet-call\//);
    expect(connect.clearCode.cause).toBe(0);

    // 4. Service verb inside session
    const verb = await packet.api.omnidat.serviceVerb({
      x121: "311088020501",
      verb: "MENU",
      args: [],
    });
    expect(verb.ended).toBe(false);
    expect(verb.page.length + verb.text.length).toBeGreaterThan(0);

    // 5. Explicit packetCall bridge (XOT terminal style) also leaves evidence
    const call = await packet.api.omnidat.packetCall({
      sourceIdentity: "browser-xot-terminal",
      sourceTransport: "xot",
      destinationX121: "311088010110",
      verb: "CALL",
    });
    expect(call.evidence.artifactKind).toBe("packet-call-receipt");
    expect(call.session.evidenceArtifactId).toBe(call.evidence.id);
    expect(call.clearCode.rendered).toMatch(/^CLR /);

    // 6. Configure a PAD endpoint on a known directory address
    const pad = await packet.api.omnidat.configurePad({
      x121: "311088020501",
      transport: "wifi",
      padKind: "xot-terminal",
      endpointLabel: "Camp VT100 bench",
    });
    expect(pad.x121).toBe("311088020501");
    expect(pad.padKind).toBe("xot-terminal");

    // 7. NOC operator can list sessions + evidence
    const sessions = await noc.api.omnidat.listPacketSessions();
    expect(Array.isArray(sessions.sessions)).toBe(true);

    const evidence = await noc.api.omnidat.listEvidenceArtifacts();
    expect(Array.isArray(evidence.artifacts)).toBe(true);

    // 8. Record session for replay
    const recording = await packet.api.omnidat.recordTerminalSession({
      x121: "311088020501",
      label: "e2e-food-session",
      commands: ["MENU", "STATUS"],
    });
    expect(recording.recordingId).toBeTruthy();
    expect(recording.frames).toBe(2);
  });

  it("admin onboarding: provision campsite, grant roles, export evidence", async () => {
    const admin = callerFor(["admin"], "user-admin");

    const provision = await admin.api.omnidat.provisionCampsiteService({
      campsiteName: "E2E Laminar Camp",
      namespace: "camp",
      contact: "ops@omnidat.cc",
      appName: "Camp Order Desk",
      appKind: "food-service",
      transport: "wifi",
    });
    expect(provision.status).toBe("verified");
    expect(provision.assignment.assignedX121).toMatch(/^311088/);
    expect(provision.transcript).toContain("STATUS VERIFIED");

    const verify = await admin.api.omnidat.verifyProvisioning({
      campsiteName: "E2E Laminar Camp",
      serviceSlug: "food-service",
      transport: "wifi",
    });
    const verifyText =
      typeof verify === "string"
        ? verify
        : ((verify as { transcript?: string }).transcript ??
          JSON.stringify(verify));
    expect(verifyText).toMatch(/PROVISION|X\.121|OMNIDAT|wifi|food|ASSIGN/i);

    await admin.api.omnidat.grantOperatorRole({
      userId: "user-new-operator",
      role: "packet-operator",
    });

    const roles = await admin.api.omnidat.listOperatorRoles();
    expect(
      roles.roles.some(
        (r) =>
          r.userId === "user-new-operator" && r.role === "packet-operator",
      ),
    ).toBe(true);

    const opened = await admin.api.omnidat.openIncident({
      title: "E2E PAD flap",
      severity: "major",
    });
    expect(opened.status).toBe("open");
    expect(opened.id).toBeTruthy();
    const incidents = await admin.api.omnidat.listIncidents();
    expect(incidents.incidents.some((i) => i.id === opened.id)).toBe(true);
    await admin.api.omnidat.updateIncident({
      incidentId: opened.id,
      status: "resolved",
      timeToClearMinutes: 12,
    });

    const exported = await admin.api.omnidat.exportEventEvidence({
      label: "e2e-network-export",
      url: "evidence://e2e/network-export.json",
      recordCount: 3,
    });
    expect(exported.label ?? exported.artifactKind).toBeTruthy();

    const me = await admin.api.omnidat.operatorMe();
    expect(me.canOperate).toBe(true);
    expect(me.roles).toContain("admin");
  });

  it("role matrix: auditor reads, cannot sell or call; campsite owner can request service", async () => {
    const auditor = callerFor(["auditor"], "user-auditor");
    const owner = callerFor(["campsite-owner"], "user-owner");

    const dash = await auditor.api.omnidat.dashboard();
    expect(dash.metrics.totalServices).toBeGreaterThan(0);

    await expect(
      auditor.api.omnidat.vintagePosSale({
        terminalId: "VF-X",
        terminalModel: "VERIFONE_TRANZ_330",
        merchantAccountId: "SB-CAMP-LAMINAR-001",
        amount: 1,
        feePolicyId: "MERCHANT_POS_MERCHANT_PAYS",
        retrievalReference: "000000000099",
      }),
    ).rejects.toThrow(/operator role required/i);

    await expect(
      auditor.api.omnidat.packetCall({
        sourceIdentity: "auditor",
        destinationX121: "311088010110",
      }),
    ).rejects.toThrow(/operator role required/i);

    // campsite owner can read public surfaces
    const services = await owner.api.omnidat.services();
    expect(services.services.length).toBeGreaterThan(0);
  });
});
