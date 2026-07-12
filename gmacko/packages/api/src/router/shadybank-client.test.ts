import { describe, expect, it, vi } from "vitest";

import {
  createShadyBankClient,
  getShadyBankIntegrationProfile,
  resolveMerchantRail,
} from "./shadybank-client";

describe("merchant bank rail (OmniBank / ShadyBank)", () => {
  it("defaults to OmniBucks testnet at bucks.omnidat.cc", () => {
    const profile = getShadyBankIntegrationProfile({
      merchantToken: "merchant-token",
    });

    expect(profile.rail).toBe("omnibucks");
    expect(profile.testnet).toBe(true);
    expect(profile.baseUrl).toBe("https://bucks.omnidat.cc");
    expect(profile.protocol).toBe("OMNIBANK-OMNIBUCKS-HTTP-1");
    expect(profile.currency).toBe("OmniBucks");
    expect(profile.sourceRepo).toBe("/Volumes/dev/shady/shadybank");
    expect(profile.endpoints.map((endpoint) => endpoint.path)).toEqual(
      expect.arrayContaining([
        "/api/network",
        "/api/login",
        "/api/balance",
        "/api/authorize",
        "/api/capture",
        "/api/void",
        "/api/reverse",
        "/api/credit",
      ]),
    );
  });

  it("resolves shadybucks production rail", () => {
    const rail = resolveMerchantRail("shadybank");
    expect(rail.id).toBe("shadybucks");
    expect(rail.defaultBaseUrl).toBe("https://bucks.shady.tel");
    expect(rail.testnet).toBe(false);

    const profile = getShadyBankIntegrationProfile({
      rail: "shadybucks",
      baseUrl: "https://bucks.shady.tel",
    });
    expect(profile.configured).toBe(false);
    expect(profile.merchantLinkStatus).toBe("merchant-token-missing");
    expect(profile.protocol).toBe("SHADYBANK-SHADYBUCKS-HTTP-1");
  });

  it("authorizes and captures against the configured rail", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("654321", { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createShadyBankClient({
      rail: "omnibucks",
      baseUrl: "http://127.0.0.1:8121",
      merchantToken: "merchant-token",
      fetch,
    });

    const result = await client.authorizeAndCapture({
      amount: 19,
      pan: "4242424242424242",
      otp: "123456",
      description: "OMNIDAT X.25 ISO8583 0200 ATM-EX88-001",
    });

    expect(result.authCode).toBe("654321");
    expect(result.captured).toBe(true);
    expect(result.rail).toBe("omnibucks");
    expect(result.currencyCode).toBe("OMNI");
    expect(result.transcript).toContain("OMNIBANK POST /api/authorize");
    expect(result.transcript).toContain("AMOUNT 19.00 OMNI");
    expect(result.transcript).toContain("RAIL omnibucks");
    expect(result.transcript).not.toContain("4242424242424242");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8121/api/authorize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer merchant-token",
        }),
      }),
    );
    expect(
      ((fetch.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams).get(
        "amount",
      ),
    ).toBe("19.00");
  });
});
