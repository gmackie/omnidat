import { describe, expect, it } from "vitest";

import {
  buildNetworkSnapshot,
  buildProvisioningTranscript,
  omnidatBillingAccounts,
  omnidatCircuitMetrics,
  omnidatFoodMenu,
  omnidatServiceDefinitions,
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
    expect(atm?.verbs.find((verb) => verb.name === "WITHDRAW")?.outputs).toContain(
      "authorizationCode",
    );
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
});
