import {
  buildNetworkSnapshot,
  buildProvisioningTranscript,
  configurePad,
  createFoodOrder,
  executeXotCommand,
  getIso8583ProtocolProfile,
  getOperationalState,
  omnidatBillingAccounts,
  omnidatFoodMenu,
  omnidatServiceDefinitions,
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
  createShadyBankClient,
  getShadyBankIntegrationProfile,
  type ShadyBankClientConfig,
} from "./shadybank-client";

function shadyBankConfig(ctx: unknown): ShadyBankClientConfig {
  return (
    (ctx as { shadyBank?: ShadyBankClientConfig }).shadyBank ?? {
      baseUrl: process.env.SHADYBANK_API_URL,
      merchantToken: process.env.SHADYBANK_MERCHANT_TOKEN,
    }
  );
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
    .input(
      z.object({
        amount: z.number().positive(),
        pan: z.string().min(8).max(19),
        otp: z.string().min(1).optional(),
        terminalId: z.string().min(1),
        retrievalReference: z.string().min(1).max(12),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const iso = simulateIso8583Transaction({
        mti: "0200",
        processingCode: "000000",
        amount: input.amount,
        accountId: `PAN-${input.pan.slice(-4)}`,
        terminalId: input.terminalId,
        retrievalReference: input.retrievalReference,
      });
      const client = createShadyBankClient(shadyBankConfig(ctx));
      const shadyBank = await client.authorizeAndCapture({
        amount: input.amount,
        pan: input.pan,
        otp: input.otp,
        description: `OMNIDAT X.25 ISO8583 0200 ${input.terminalId}`,
      });

      return {
        ...iso,
        responseCode: "00" as const,
        authorizationCode: shadyBank.authCode,
        shadyBank,
        transcript: [iso.transcript, shadyBank.transcript].join("\n"),
      };
    }),

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
      return result;
    }),
} satisfies TRPCRouterRecord;
