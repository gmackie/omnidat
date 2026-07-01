import {
  buildNetworkSnapshot,
  buildProvisioningTranscript,
  omnidatBillingAccounts,
  omnidatFoodMenu,
  omnidatProvisioningRequests,
  omnidatServiceDefinitions,
} from "@omnidat/operator-core/omnidat";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { publicProcedure } from "../trpc";

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
        billingAccounts: omnidatBillingAccounts.length,
        pendingProvisioning: omnidatProvisioningRequests.length,
      },
      recentProvisioning: omnidatProvisioningRequests,
      billingAccounts: omnidatBillingAccounts,
    };
  }),

  network: publicProcedure.query(() => buildNetworkSnapshot()),

  services: publicProcedure.query(() => ({
    services: omnidatServiceDefinitions,
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
    accounts: omnidatBillingAccounts,
  })),

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
} satisfies TRPCRouterRecord;
