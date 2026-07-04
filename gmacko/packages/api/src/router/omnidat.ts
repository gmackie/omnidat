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
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { publicProcedure } from "../trpc";
import {
  loadPersistentOperationalState,
  type OmnidatPersistenceDb,
  persistAtmResult,
  persistFoodOrderResult,
  persistPadResult,
  persistPassportStampResult,
  persistProvisioningResult,
  persistXotCommandResult,
} from "./omnidat-persistence";
import {
  applyJournalBatch,
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

function syncDb(ctx: unknown) {
  return (ctx as { db?: OmnidatSyncDb }).db;
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
  dashboard: publicProcedure.query(async ({ ctx }) => {
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

  noc: publicProcedure.query(async ({ ctx }) => {
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
    };
  }),

  billing: publicProcedure.query(async ({ ctx }) => ({
    provider: "ShadyBucks",
    accounts: (
      (await loadPersistentOperationalState(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        getOperationalState(),
      )) ?? getOperationalState()
    ).billingAccounts,
  })),

  operations: publicProcedure.query(
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

  vintageTerminalDownloadPackage: publicProcedure
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

  verifyProvisioning: publicProcedure
    .input(
      z.object({
        campsiteName: z.string().min(1),
        serviceSlug: z.string().min(1),
        transport: z.string().min(1),
      }),
    )
    .mutation(({ input }) => buildProvisioningTranscript(input)),

  provisionCampsiteService: publicProcedure
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
      );
      await journalCloudWrite(syncDb(ctx), {
        opType: "provisioning.verified",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  configurePad: publicProcedure
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
      await persistPadResult((ctx as { db?: OmnidatPersistenceDb }).db, result);
      await journalCloudWrite(syncDb(ctx), {
        opType: "pad.configured",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  setupAtmTerminal: publicProcedure
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
      await persistAtmResult((ctx as { db?: OmnidatPersistenceDb }).db, result);
      await journalCloudWrite(syncDb(ctx), {
        opType: "atm.activated",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  createFoodOrder: publicProcedure
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
      );
      await journalCloudWrite(syncDb(ctx), {
        opType: "food.order.created",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  stampActivityPassport: publicProcedure
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
      );
      await journalCloudWrite(syncDb(ctx), {
        opType: "passport.stamped",
        payload: result as unknown as Record<string, unknown>,
      });
      return result;
    }),

  iso8583Transaction: publicProcedure
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

  iso8583ShadyBankPurchase: publicProcedure
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

  vintagePosSale: publicProcedure
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

  xotCommand: publicProcedure
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
      });
      await journalCloudWrite(syncDb(ctx), {
        opType: "xot.command",
        payload: { ...input, result } as unknown as Record<string, unknown>,
      });
      return result;
    }),

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

  transferAuthority: publicProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        toHolder: z.enum(["field", "cloud"]),
        toSourceId: z.string().min(1),
        reason: z.string().min(1),
        operatorId: z.string().min(1),
        syncToken: z.string().min(1),
        targetWatermarks: z.record(z.string(), z.number()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = syncDb(ctx);
      await verifySyncToken(db, input.syncToken);
      return transferEventAuthority(db, input);
    }),
} satisfies TRPCRouterRecord;
