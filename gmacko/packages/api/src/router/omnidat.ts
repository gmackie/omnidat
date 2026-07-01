import {
  buildNetworkSnapshot,
  buildProvisioningTranscript,
  configurePad,
  executeXotCommand,
  getOperationalState,
  omnidatBillingAccounts,
  omnidatFoodMenu,
  omnidatServiceDefinitions,
  provisionCampsiteService,
  setupAtmTerminal,
} from "@omnidat/operator-core/omnidat";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { publicProcedure } from "../trpc";
import {
  persistAuditEvent,
  projectAtmPersistenceRows,
  projectPadPersistenceRows,
  projectProvisioningPersistenceRows,
  projectXotCommandPersistenceRows,
  type OmnidatPersistenceDb,
} from "./omnidat-persistence";

export const omnidatRouter = {
  dashboard: publicProcedure.query(() => {
    const snapshot = buildNetworkSnapshot();
    const upServices = snapshot.services.filter(
      (service) => service.status === "up",
    ).length;
    const degradedCircuits = snapshot.circuits.filter(
      (circuit) => circuit.status === "degraded",
    ).length;

    return {
      network: {
        protocol: snapshot.protocol,
        status: snapshot.status,
        source: snapshot.source,
      },
      metrics: {
        totalServices: snapshot.services.length,
        upServices,
        degradedCircuits,
        billingAccounts: getOperationalState().billingAccounts.length,
        pendingProvisioning: getOperationalState().provisioningRequests.length,
      },
      recentProvisioning: getOperationalState().provisioningRequests,
      billingAccounts: getOperationalState().billingAccounts,
    };
  }),

  network: publicProcedure.query(() => buildNetworkSnapshot()),

  services: publicProcedure.query(() => ({
    services: getOperationalState().services,
  })),

  noc: publicProcedure.query(() => {
    const snapshot = buildNetworkSnapshot();
    return {
      center: "Exchange 88 Network Operations Center",
      adapter: {
        protocol: snapshot.protocol,
        source: snapshot.source,
        status: snapshot.status,
      },
      circuits: snapshot.circuits,
      services: snapshot.services,
    };
  }),

  billing: publicProcedure.query(() => ({
    provider: "ShadyBucks",
    accounts: getOperationalState().billingAccounts,
  })),

  operations: publicProcedure.query(() => getOperationalState()),

  foodProtocol: publicProcedure.query(() => ({
    protocol: "OMNIDAT-FOOD-1",
    x121: "311088020501",
    menu: omnidatFoodMenu,
    verbs:
      omnidatServiceDefinitions.find((service) => service.slug === "food-service")
        ?.verbs ?? [],
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
      omnidatServiceDefinitions.find((service) => service.slug === "shadybucks-atm")
        ?.verbs ?? [],
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
      await persistAuditEvent(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        projectProvisioningPersistenceRows(result).auditEvent,
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
      await persistAuditEvent(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        projectPadPersistenceRows(result).auditEvent,
      );
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
      await persistAuditEvent(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        projectAtmPersistenceRows(result).auditEvent,
      );
      return result;
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
      await persistAuditEvent(
        (ctx as { db?: OmnidatPersistenceDb }).db,
        projectXotCommandPersistenceRows({ ...input, result }).auditEvent,
      );
      return result;
    }),
} satisfies TRPCRouterRecord;
