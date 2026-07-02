import { describe, expect, it, vi } from "vitest";

import {
  createShadyBankClient,
  getShadyBankIntegrationProfile,
} from "./shadybank-client";

describe("Shady Bank HTTP integration", () => {
  it("describes the checked-out Shady Bank API contract", () => {
    const profile = getShadyBankIntegrationProfile({
      baseUrl: "http://127.0.0.1:8021",
      merchantToken: "merchant-token",
    });

    expect(profile.configured).toBe(true);
    expect(profile.sourceRepo).toBe("/Volumes/dev/shady/shadybank");
    expect(profile.protocol).toBe("SHADYBANK-SHADYBUCKS-HTTP-1");
    expect(profile.endpoints.map((endpoint) => endpoint.path)).toEqual(
      expect.arrayContaining([
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

  it("authorizes and captures a purchase against the Shady Bank merchant API", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("654321", { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createShadyBankClient({
      baseUrl: "http://127.0.0.1:8021",
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
    expect(result.transcript).toContain("POST /api/authorize");
    expect(result.transcript).toContain("POST /api/capture");
    expect(result.transcript).not.toContain("4242424242424242");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8021/api/authorize",
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
    expect(
      ((fetch.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams).get(
        "pan",
      ),
    ).toBe("4242424242424242");
    expect(
      ((fetch.mock.calls[1]?.[1] as RequestInit).body as URLSearchParams).get(
        "auth_code",
      ),
    ).toBe("654321");
  });

  it("authorizes and captures a track-2 purchase without sending PAN credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("751860", { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createShadyBankClient({
      baseUrl: "http://192.168.97.4:8080",
      merchantToken: "merchant-token",
      fetch,
    });

    const result = await client.authorizeAndCapture({
      amount: 19.25,
      track2: ";4111111111111111=2901123123456?",
      description: "OMNIDAT X.25 ISO8583 0200 ATM-EX88-001",
    });

    expect(result.authCode).toBe("751860");
    expect(result.captured).toBe(true);
    expect(result.transcript).toContain("TRACK2 ************1111");
    expect(result.transcript).not.toContain("4111111111111111");
    expect(
      ((fetch.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams).get(
        "track2",
      ),
    ).toBe(";4111111111111111=2901123123456?");
    expect(
      ((fetch.mock.calls[0]?.[1] as RequestInit).body as URLSearchParams).get(
        "pan",
      ),
    ).toBeNull();
  });
});
