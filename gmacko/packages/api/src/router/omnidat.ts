import { and, eq } from "@omnidat/db";
import {
  omnidatAuditEvent,
  omnidatOperatorRole,
} from "@omnidat/db/schema";
import {
  buildNetworkSnapshot,
  buildProvisioningTranscript,
  buildVintageTerminalDownloadPackage,
  configurePad,
  createFoodOrder,
  executeXotCommand,
  getIso8583ProtocolProfile,
  getOperationalState,
  getVintageTerminalProgramPack,
  omnidatBillingAccounts,
  omnidatFoodMenu,
  omnidatServiceDefinitions,
  processVintagePosSale,
  provisionCampsiteService,
  setupAtmTerminal,
  simulateIso8583Transaction,
  stampActivityPassport,
} from "@omnidat/operator-core/omnidat";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { publicProcedure } from "../trpc";
import {
  omnidatOperatorProcedure,
  omnidatOperatorReadProcedure,
} from "./omnidat-operator-procedure";
import { OMNIDAT_ROLES } from "./omnidat-roles";
import { buildOmnidatDocument } from "./omnidat-documents";
import { recordOperationalMetric } from "./omnidat-kpi";
import {
  IllegalProvisioningTransition,
  loadAllocations,
  loadCampsites,
  loadEvents,
  loadEvidenceArtifacts,
  loadOperatorRoleGrants,
  loadPacketSessions,
  loadPersistentOperationalState,
  loadProvisioning,
  type OmnidatAuditActor,
  type OmnidatPersistenceDb,
  persistAllocationAssign,
  persistAllocationStatus,
  persistAtmResult,
  persistBillingAccountCreate,
  persistCampsiteCreate,
  persistCampsiteStatus,
  persistEventCreate,
  persistEventEvidenceExport,
  persistEventStatus,
  persistEvidenceArtifact,
  persistFeePolicy,
  persistIncidentOpen,
  persistIncidentUpdate,
  persistProvisioningAdvance,
  persistProvisioningRequest,
  persistFoodOrderResult,
  persistPacketSessionClear,
  persistPacketSessionOpen,
  persistPadResult,
  persistPassportStampResult,
  persistProvisioningResult,
  persistServiceVerbDisable,
  persistServiceVerbUpsert,
  persistXotCommandResult,
} from "./omnidat-persistence";
import {
  applyJournalBatch,
  computeSyncStatus,
  getCurrentAuthority,
  journalCloudWrite,
  listSyncSources,
  type OmnidatSyncDb,
  pullJournalEntries,
  transferEventAuthority,
  verifySyncToken,
} from "./omnidat-sync";
import {
  createShadyBankClient,
  getShadyBankIntegrationProfile,
  type ShadyBankClientConfig,
} from "./shadybank-client";

const syncViewInput = z
  .object({
    eventId: z.string().min(1).nullish(),
    now: z.string().min(1).optional(),
  })
  .optional();

function syncViewNow(input: { now?: string } | null | undefined) {
  return input?.now ? new Date(input.now) : new Date();
}

function syncDb(ctx: unknown) {
  return (ctx as { db?: OmnidatSyncDb }).db;
}

function dbOf(ctx: unknown) {
  return (ctx as { db?: OmnidatPersistenceDb }).db;
}

function auditActor(ctx: unknown): OmnidatAuditActor | undefined {
  const operator = (ctx as { operator?: OmnidatAuditActor }).operator;
  if (!operator) return undefined;
  return operator;
}

const journalEntryInput = z.object({
  seq: z.number().int().positive(),
  eventId: z.string().min(1).nullish(),
  epoch: z.number().int().min(0),
  opType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(1),
  payloadChecksum: z.string().min(1),
  recordedAt: z.string().min(1),
});

function shadyBankConfig(ctx: unknown): ShadyBankClientConfig {
  return (
    (ctx as { shadyBank?: ShadyBankClientConfig }).shadyBank ?? {
      baseUrl: process.env.SHADYBANK_API_URL,
      merchantToken: process.env.SHADYBANK_MERCHANT_TOKEN,
    }
  );
}

function panFromTrack2(track2: string) {
  return track2.match(/;(?<pan>\d{8,19})=/)?.groups?.pan ?? track2;
}

const iso8583ShadyBankPurchaseInput = z
  .object({
    amount: z.number().positive(),
    pan: z.string().min(8).max(19).optional(),
    otp: z.string().min(1).optional(),
    track2: z.string().min(1).optional(),
    terminalId: z.string().min(1),
    retrievalReference: z.string().min(1).max(12),
  })
  .refine((input) => Boolean(input.pan || input.track2), {
    message: "PAN or track-2 card data is required",
  });

function settleIsoResponseWithShadyBankAuth(
  iso: ReturnType<typeof simulateIso8583Transaction>,
  authCode: string,
) {
  return {
    ...iso,
    responseCode: "00" as const,
    authorizationCode: authCode,
    packedResponse: iso.packedResponse
      .replace(/DE038=[^|]*/, `DE038=${authCode}`)
      .replace(/DE039=[^|]*/, "DE039=00"),
    transcript: iso.transcript
      .replace(/^RC .*/m, "RC 00")
      .replace(/^AUTH .*/m, `AUTH ${authCode}`),
  };
}

export const omnidatRouter = {
  dashboard: omnidatOperatorReadProcedure.input(syncViewInput).query(async ({ ctx, input }) => {
    const operationalState =
      (await loadPersistentOperationalState(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        getOperationalState(),
      )) ?? getOperationalState();
    const snapshot = buildNetworkSnapshot();
    const services = operationalState.services;
    const circuits = operationalState.circuits;
    const upServices = services.filter(
      (service) => service.status === "up",
    ).length;
    const degradedCircuits = circuits.filter(
      (circuit) => circuit.status === "degraded",
    ).length;

    return {
      network: {
        protocol: snapshot.protocol,
        status: snapshot.status,
        source: snapshot.source,
      },
      metrics: {
        totalServices: services.length,
        upServices,
        degradedCircuits,
        billingAccounts: operationalState.billingAccounts.length,
        pendingProvisioning: operationalState.provisioningRequests.length,
      },
      recentProvisioning: operationalState.provisioningRequests,
      billingAccounts: operationalState.billingAccounts,
      sync: await computeSyncStatus(
        syncDb(ctx),
        input?.eventId ?? null,
        syncViewNow(input),
      ),
    };
  }),

  network: publicProcedure.query(() => buildNetworkSnapshot()),

  services: publicProcedure.query(async ({ ctx }) => ({
    services: (
      (await loadPersistentOperationalState(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        getOperationalState(),
      )) ?? getOperationalState()
    ).services,
  })),

  noc: omnidatOperatorReadProcedure.input(syncViewInput).query(async ({ ctx, input }) => {
    const snapshot = buildNetworkSnapshot();
    const operationalState =
      (await loadPersistentOperationalState(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        getOperationalState(),
      )) ?? getOperationalState();
    return {
      center: "Exchange 88 Network Operations Center",
      adapter: {
        protocol: snapshot.protocol,
        source: snapshot.source,
        status: snapshot.status,
      },
      circuits: operationalState.circuits,
      services: operationalState.services,
      sync: await computeSyncStatus(
        syncDb(ctx),
        input?.eventId ?? null,
        syncViewNow(input),
      ),
    };
  }),

  billing: omnidatOperatorReadProcedure.query(async ({ ctx }) => ({
    provider: "ShadyBucks",
    accounts: (
      (await loadPersistentOperationalState(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        getOperationalState(),
      )) ?? getOperationalState()
    ).billingAccounts,
  })),

  operations: omnidatOperatorReadProcedure.query(
    async ({ ctx }) =>
      (await loadPersistentOperationalState(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        getOperationalState(),
      )) ?? getOperationalState(),
  ),

  foodProtocol: publicProcedure.query(() => ({
    protocol: "OMNIDAT-FOOD-1",
    x121: "311088020501",
    menu: omnidatFoodMenu,
    verbs:
      omnidatServiceDefinitions.find(
        (service) => service.slug === "food-service",
      )?.verbs ?? [],
    waitLines: [
      {
        lineId: "WINDOW-3",
        label: "Counter Window 3",
        status: "accepting-orders",
        estimatedWaitMinutes: 9,
      },
    ],
  })),

  atmProtocol: publicProcedure.query(() => ({
    protocol: "SHADYBUCKS-ATM-X25-1",
    x121: "311088030100",
    setupChecklist: [
      "Assign X.121 terminal address",
      "Bind terminal to ShadyBucks settlement account",
      "Verify BALANCE and WITHDRAW verbs over X.25",
      "Print activation receipt for the camp operator",
    ],
    verbs:
      omnidatServiceDefinitions.find(
        (service) => service.slug === "shadybucks-atm",
      )?.verbs ?? [],
    iso8583: getIso8583ProtocolProfile(),
  })),

  vintageTerminalProgramPack: publicProcedure.query(() =>
    getVintageTerminalProgramPack(),
  ),

  vintageTerminalDownloadPackage: omnidatOperatorProcedure("vendor.write")
    .input(
      z.object({
        terminalId: z.string().min(1),
        merchantAccountId: z.string().min(1),
        family: z.enum(["TRANZ_330_380_TCL", "OMNI_3200_ZONTALK"]),
      }),
    )
    .mutation(({ input }) => buildVintageTerminalDownloadPackage(input)),

  shadyBankStatus: publicProcedure.query(({ ctx }) => ({
    profile: getShadyBankIntegrationProfile(shadyBankConfig(ctx)),
  })),

  verifyProvisioning: omnidatOperatorProcedure("provisioning.write")
    .input(
      z.object({
        campsiteName: z.string().min(1),
        serviceSlug: z.string().min(1),
        transport: z.string().min(1),
      }),
    )
    .mutation(({ input }) => buildProvisioningTranscript(input)),

  provisionCampsiteService: omnidatOperatorProcedure("provisioning.write")
    .input(
      z.object({
        campsiteName: z.string().min(1),
        namespace: z.string().min(1).default("camp"),
        contact: z.string().min(1),
        appName: z.string().min(1),
        appKind: z.string().min(1),
        transport: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = provisionCampsiteService(input);
      await persistProvisioningResult(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        result,
        auditActor(ctx),
      );
      await journalCloudWrite(syncDb(ctx), {
        opType: "provisioning.verified",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  configurePad: omnidatOperatorProcedure("provisioning.write")
    .input(
      z.object({
        x121: z.string().min(6),
        transport: z.string().min(1),
        padKind: z.enum([
          "meshcore-pad",
          "meshtastic-pad",
          "wifi-terminal",
          "pots-pad",
          "xot-terminal",
        ]),
        endpointLabel: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = configurePad(input);
      await persistPadResult(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        result,
        auditActor(ctx),
      );
      await journalCloudWrite(syncDb(ctx), {
        opType: "pad.configured",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  setupAtmTerminal: omnidatOperatorProcedure("bank.write")
    .input(
      z.object({
        terminalId: z.string().min(1),
        settlementAccountId: z.string().min(1),
        terminalX121: z.string().optional(),
        locationLabel: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = setupAtmTerminal(input);
      await persistAtmResult(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        result,
        auditActor(ctx),
      );
      await journalCloudWrite(syncDb(ctx), {
        opType: "atm.activated",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  createFoodOrder: omnidatOperatorProcedure("vendor.write")
    .input(
      z.object({
        itemIds: z.array(z.string().min(1)).min(1),
        pickupName: z.string().min(1),
        shadybucksAccountId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = createFoodOrder(input);
      await persistFoodOrderResult(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        result,
        auditActor(ctx),
      );
      await journalCloudWrite(syncDb(ctx), {
        opType: "food.order.created",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  stampActivityPassport: omnidatOperatorProcedure("vendor.write")
    .input(
      z.object({
        passportId: z.string().min(1),
        badgeId: z.string().min(1),
        operatorId: z.string().min(1),
        evidence: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = stampActivityPassport(input);
      await persistPassportStampResult(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        result,
        auditActor(ctx),
      );
      await journalCloudWrite(syncDb(ctx), {
        opType: "passport.stamped",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  iso8583Transaction: omnidatOperatorProcedure("bank.write")
    .input(
      z.object({
        mti: z.enum(["0100", "0200", "0400", "0800"]),
        processingCode: z.enum([
          "000000",
          "010000",
          "310000",
          "210000",
          "920000",
        ]),
        amount: z.number().positive(),
        accountId: z.string().min(1),
        terminalId: z.string().min(1),
        retrievalReference: z.string().min(1).max(12),
      }),
    )
    .mutation(({ input }) => simulateIso8583Transaction(input)),

  iso8583ShadyBankPurchase: omnidatOperatorProcedure("bank.write")
    .input(iso8583ShadyBankPurchaseInput)
    .mutation(async ({ ctx, input }) => {
      const cardReference = input.track2
        ? panFromTrack2(input.track2)
        : (input.pan ?? "");
      const iso = simulateIso8583Transaction({
        mti: "0200",
        processingCode: "000000",
        amount: input.amount,
        accountId: `PAN-${cardReference.slice(-4)}`,
        terminalId: input.terminalId,
        retrievalReference: input.retrievalReference,
      });
      const client = createShadyBankClient(shadyBankConfig(ctx));
      const shadyBank = await client.authorizeAndCapture({
        amount: input.amount,
        ...(input.track2
          ? { track2: input.track2 }
          : { pan: input.pan ?? "", otp: input.otp }),
        description: `OMNIDAT X.25 ISO8583 0200 ${input.terminalId}`,
      });
      const settledIso = settleIsoResponseWithShadyBankAuth(
        iso,
        shadyBank.authCode,
      );

      return {
        ...settledIso,
        shadyBank,
        transcript: [settledIso.transcript, shadyBank.transcript].join("\n"),
      };
    }),

  vintagePosSale: omnidatOperatorProcedure("vendor.write")
    .input(
      z.object({
        terminalId: z.string().min(1),
        terminalModel: z.enum([
          "VERIFONE_TRANZ_330",
          "VERIFONE_TRANZ_380",
          "VERIFONE_OMNI_3200",
          "VERIFONE_OMNI_3750",
          "UNKNOWN_DIAL_POS",
        ]),
        merchantAccountId: z.string().min(1),
        clerkCode: z.string().min(1).optional(),
        amount: z.number().positive(),
        feePolicyId: z.string().min(1),
        noteSerial: z.string().min(1).optional(),
        retrievalReference: z.string().min(1).max(12),
      }),
    )
    .mutation(({ input }) => processVintagePosSale(input)),

  xotCommand: omnidatOperatorProcedure("session.write")
    .input(
      z.object({
        sourceX121: z.string().min(6),
        command: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = executeXotCommand(input);
      await persistXotCommandResult((ctx as { db?: OmnidatPersistenceDb }).db, {
        ...input,
        result,
      }, auditActor(ctx));
      await journalCloudWrite(syncDb(ctx), {
        opType: "xot.command",
        payload: { ...input, result } as unknown as Record<string, unknown>,
      });
      return result;
    }),

  openPacketSession: omnidatOperatorProcedure("session.write")
    .input(
      z.object({
        eventId: z.string().min(1).nullish(),
        serviceId: z.string().min(1).nullish(),
        sourceIdentity: z.string().min(1),
        sourceTransport: z.string().min(1),
        sourceX121: z.string().min(1).nullish(),
        destinationX121: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await persistPacketSessionOpen(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        input,
        auditActor(ctx),
      );
      await recordOperationalMetric((ctx as { db?: OmnidatPersistenceDb }).db, {
        metricName: "packet.session.opened",
        value: 1,
        unit: "session",
      });
      return session;
    }),

  clearPacketSession: omnidatOperatorProcedure("session.write")
    .input(
      z.object({
        sessionId: z.string().min(1),
        // Raw X.25 clear cause and diagnostic code points (protocol-fidelity).
        clearCause: z.number().int().min(0).max(255),
        clearDiagnostic: z.number().int().min(0).max(255),
        transcript: z.string().min(1),
        evidenceArtifactId: z.string().min(1).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cleared = await persistPacketSessionClear(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        input,
        auditActor(ctx),
      );
      await recordOperationalMetric((ctx as { db?: OmnidatPersistenceDb }).db, {
        metricName: `packet.session.cleared.cause.${input.clearCause}`,
        value: 1,
        unit: "session",
      });
      return cleared;
    }),

  listPacketSessions: omnidatOperatorReadProcedure.query(async ({ ctx }) => ({
    sessions: await loadPacketSessions((ctx as { db?: OmnidatPersistenceDb }).db),
  })),

  createEvidenceArtifact: omnidatOperatorProcedure("evidence.write")
    .input(
      z.object({
        eventId: z.string().min(1).nullish(),
        artifactKind: z.string().min(1),
        label: z.string().min(1),
        url: z.string().min(1),
        recordCount: z.number().int().nonnegative().nullish(),
        contentType: z.string().min(1).optional(),
        checksum: z.string().min(1).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const artifact = await persistEvidenceArtifact(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        input,
        auditActor(ctx),
      );
      await recordOperationalMetric((ctx as { db?: OmnidatPersistenceDb }).db, {
        metricName: "evidence.artifact.created",
        value: 1,
        unit: "artifact",
      });
      return artifact;
    }),

  listEvidenceArtifacts: omnidatOperatorReadProcedure
    .input(z.object({ artifactKind: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => ({
      artifacts: await loadEvidenceArtifacts(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        input?.artifactKind,
      ),
    })),

  upsertServiceVerb: omnidatOperatorProcedure("verb.write")
    .input(
      z.object({
        serviceId: z.string().min(1),
        verb: z.string().min(1),
        description: z.string().min(1).nullish(),
        inputs: z.array(z.string().min(1)).optional(),
        outputs: z.array(z.string().min(1)).optional(),
        securityPolicy: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const verb = await persistServiceVerbUpsert(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        input,
        auditActor(ctx),
      );
      await recordOperationalMetric((ctx as { db?: OmnidatPersistenceDb }).db, {
        metricName: "service.verb.called",
        value: 1,
        unit: "verb",
        serviceId: input.serviceId,
      });
      return verb;
    }),

  disableServiceVerb: omnidatOperatorProcedure("verb.write")
    .input(z.object({ serviceId: z.string().min(1), verb: z.string().min(1) }))
    .mutation(async ({ ctx, input }) =>
      persistServiceVerbDisable(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        input,
        auditActor(ctx),
      ),
    ),

  grantOperatorRole: omnidatOperatorProcedure("role.write")
    .input(
      z.object({
        userId: z.string().min(1),
        role: z.enum(OMNIDAT_ROLES),
        eventId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const grant = {
        userId: input.userId,
        role: input.role,
        eventId: input.eventId ?? null,
        active: true,
      };
      await ctx.db
        .insert(omnidatOperatorRole)
        .values(grant)
        .onConflictDoUpdate({
          target: [
            omnidatOperatorRole.userId,
            omnidatOperatorRole.eventId,
            omnidatOperatorRole.role,
          ],
          set: { active: true },
        });
      await ctx.db.insert(omnidatAuditEvent).values({
        actorUserId: ctx.operator.userId,
        eventType: "role.granted",
        subjectKind: "operator-role",
        subjectId: input.userId,
        details: {
          grantedRole: input.role,
          eventId: input.eventId ?? null,
          actorRoles: ctx.operator.roles,
        },
      });
      return grant;
    }),

  revokeOperatorRole: omnidatOperatorProcedure("role.write")
    .input(
      z.object({
        userId: z.string().min(1),
        role: z.enum(OMNIDAT_ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(omnidatOperatorRole)
        .set({ active: false })
        .where(
          and(
            eq(omnidatOperatorRole.userId, input.userId),
            eq(omnidatOperatorRole.role, input.role),
          ),
        );
      await ctx.db.insert(omnidatAuditEvent).values({
        actorUserId: ctx.operator.userId,
        eventType: "role.revoked",
        subjectKind: "operator-role",
        subjectId: input.userId,
        details: {
          revokedRole: input.role,
          actorRoles: ctx.operator.roles,
        },
      });
      return { ...input, active: false };
    }),

  // --- H1b operator CRUD ---------------------------------------------------

  createEvent: omnidatOperatorProcedure("event.write")
    .input(
      z.object({
        eventCode: z.string().min(1),
        displayName: z.string().min(1),
        eventKind: z.string().min(1).optional(),
        startsAt: z.string().min(1).nullish(),
        endsAt: z.string().min(1).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistEventCreate(dbOf(ctx), input, auditActor(ctx)),
    ),

  updateEventStatus: omnidatOperatorProcedure("event.write")
    .input(
      z.object({
        eventId: z.string().min(1),
        status: z.enum(["planning", "active", "closed", "archived"]),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistEventStatus(dbOf(ctx), input, auditActor(ctx)),
    ),

  listEvents: omnidatOperatorReadProcedure.query(async ({ ctx }) => ({
    events: await loadEvents(dbOf(ctx)),
  })),

  createCampsite: omnidatOperatorProcedure("campsite.write")
    .input(
      z.object({
        namespace: z.string().min(1).optional(),
        slug: z.string().min(1),
        displayName: z.string().min(1),
        contactHandle: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistCampsiteCreate(dbOf(ctx), input, auditActor(ctx)),
    ),

  updateCampsiteStatus: omnidatOperatorProcedure("campsite.write")
    .input(
      z.object({
        campsiteId: z.string().min(1),
        status: z.enum(["pending", "active", "suspended"]),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistCampsiteStatus(dbOf(ctx), input, auditActor(ctx)),
    ),

  listCampsites: omnidatOperatorReadProcedure.query(async ({ ctx }) => ({
    campsites: await loadCampsites(dbOf(ctx)),
  })),

  allocateAddress: omnidatOperatorProcedure("allocation.write")
    .input(
      z.object({
        networkId: z.string().min(1).nullish(),
        x121: z.string().min(1),
        assignedToKind: z.string().min(1),
        assignedToId: z.string().min(1).nullish(),
        namespace: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const allocation = await persistAllocationAssign(
        dbOf(ctx),
        input,
        auditActor(ctx),
      );
      await recordOperationalMetric(dbOf(ctx), {
        metricName: "x121.allocation.assigned",
        value: 1,
        unit: "allocation",
      });
      return allocation;
    }),

  updateAllocationStatus: omnidatOperatorProcedure("allocation.write")
    .input(
      z.object({
        allocationId: z.string().min(1),
        x121: z.string().min(1),
        status: z.enum([
          "reserved",
          "assigned",
          "verified",
          "suspended",
          "revoked",
        ]),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistAllocationStatus(dbOf(ctx), input, auditActor(ctx)),
    ),

  listAllocations: omnidatOperatorReadProcedure
    .input(z.object({ status: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => ({
      allocations: await loadAllocations(dbOf(ctx), input?.status),
    })),

  requestProvisioning: omnidatOperatorProcedure("service.request")
    .input(
      z.object({
        campsiteId: z.string().min(1).nullish(),
        serviceId: z.string().min(1).nullish(),
        transport: z.string().min(1),
        requestedX121: z.string().min(1).nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistProvisioningRequest(dbOf(ctx), input, auditActor(ctx)),
    ),

  advanceProvisioning: omnidatOperatorProcedure("provisioning.write")
    .input(
      z.object({
        requestId: z.string().min(1),
        toStatus: z.enum([
          "reviewed",
          "approved",
          "assigned",
          "installed",
          "verified",
          "active",
          "suspended",
          "revoked",
        ]),
        verificationTranscript: z.string().min(1).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await persistProvisioningAdvance(dbOf(ctx), input, auditActor(ctx));
      } catch (error) {
        if (error instanceof IllegalProvisioningTransition) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),

  listProvisioning: omnidatOperatorReadProcedure.query(async ({ ctx }) => ({
    provisioning: await loadProvisioning(dbOf(ctx)),
  })),

  openIncident: omnidatOperatorProcedure("incident.write")
    .input(
      z.object({
        networkId: z.string().min(1).nullish(),
        serviceId: z.string().min(1).nullish(),
        title: z.string().min(1),
        severity: z.enum(["minor", "major", "critical"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const incident = await persistIncidentOpen(dbOf(ctx), input, auditActor(ctx));
      await recordOperationalMetric(dbOf(ctx), {
        metricName: "incident.opened",
        value: 1,
        unit: "incident",
      });
      return incident;
    }),

  updateIncident: omnidatOperatorProcedure("incident.write")
    .input(
      z.object({
        incidentId: z.string().min(1),
        status: z.enum(["open", "mitigating", "resolved"]),
        timeToClearMinutes: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await persistIncidentUpdate(dbOf(ctx), input, auditActor(ctx));
      if (input.status === "resolved") {
        await recordOperationalMetric(dbOf(ctx), {
          metricName: "incident.resolved",
          value: input.timeToClearMinutes ?? 0,
          unit: "minutes",
        });
      }
      return updated;
    }),

  createBillingAccount: omnidatOperatorProcedure("bank.write")
    .input(
      z.object({
        externalAccountId: z.string().min(1),
        accountType: z.string().min(1),
        displayName: z.string().min(1),
        provider: z.string().min(1).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistBillingAccountCreate(dbOf(ctx), input, auditActor(ctx)),
    ),

  setFeePolicy: omnidatOperatorProcedure("bank.write")
    .input(
      z.object({
        accountId: z.string().min(1),
        policyKind: z.enum([
          "flat",
          "percentage",
          "per-message",
          "waived",
          "sponsored",
          "merchant-pays",
          "operator-pays",
        ]),
        amount: z.number().int().optional(),
        memo: z.string().min(1).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistFeePolicy(dbOf(ctx), input, auditActor(ctx)),
    ),

  listOperatorRoles: omnidatOperatorProcedure("role.write").query(
    async ({ ctx }) => ({
      roles: await loadOperatorRoleGrants(dbOf(ctx)),
    }),
  ),

  exportEventEvidence: omnidatOperatorProcedure("evidence.write")
    .input(
      z.object({
        eventId: z.string().min(1).nullish(),
        label: z.string().min(1),
        url: z.string().min(1),
        recordCount: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      persistEventEvidenceExport(dbOf(ctx), input, auditActor(ctx)),
    ),

  renderDocument: omnidatOperatorReadProcedure
    .input(
      z.object({
        kind: z.enum([
          "address-assignment",
          "demarc-sheet",
          "service-certificate",
          "provisioning-transcript",
          "daily-noc-summary",
        ]),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .query(({ input }) => buildOmnidatDocument(input.kind, input.data)),

  // Sync procedures authenticate with a per-source sync token instead of a
  // capability from the H1a matrix; the H1a router-walk test annotates them
  // as exceptions until the sync credential model lands (see
  // docs/plans/2026-07-04-split-authority-sync.md).
  syncPush: publicProcedure
    .input(
      z.object({
        sourceId: z.string().min(1),
        syncToken: z.string().min(1),
        entries: z.array(journalEntryInput),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = syncDb(ctx);
      await verifySyncToken(db, input.syncToken, input.sourceId);
      return applyJournalBatch(db, {
        sourceId: input.sourceId,
        entries: input.entries,
      });
    }),

  syncPull: publicProcedure
    .input(
      z.object({
        sourceId: z.string().min(1),
        syncToken: z.string().min(1),
        eventId: z.string().min(1).nullish(),
        watermarks: z.record(z.string(), z.number()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = syncDb(ctx);
      await verifySyncToken(db, input.syncToken, input.sourceId);
      const entries = await pullJournalEntries(db, {
        sourceId: input.sourceId,
        watermarks: input.watermarks,
      });
      return {
        entries,
        authority: await getCurrentAuthority(db, input.eventId ?? null),
      };
    }),

  authorityStatus: publicProcedure
    .input(z.object({ eventId: z.string().min(1).nullish() }).optional())
    .query(async ({ ctx, input }) => {
      const db = syncDb(ctx);
      return {
        authority: await getCurrentAuthority(db, input?.eventId ?? null),
        sources: await listSyncSources(db),
      };
    }),

  // Authority failover is a NOC operator action, gated on the
  // authority.transfer capability and attributed to the acting operator. NOC
  // operators authenticate with an operator session (an API key works via
  // `Bearer gmk_...`), not a field-kit sync token.
  transferAuthority: omnidatOperatorProcedure("authority.transfer")
    .input(
      z.object({
        eventId: z.string().min(1),
        toHolder: z.enum(["field", "cloud"]),
        toSourceId: z.string().min(1),
        reason: z.string().min(1),
        targetWatermarks: z.record(z.string(), z.number()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = auditActor(ctx);
      return transferEventAuthority(syncDb(ctx), {
        ...input,
        operatorId: actor?.userId ?? "unknown-operator",
      });
    }),
} satisfies TRPCRouterRecord;
