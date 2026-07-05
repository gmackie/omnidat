import { describe, expect, it } from "vitest";

import { checkTransport, transportPolicy } from "./omnidat-transports";

describe("OMNIDAT transport adapters", () => {
  it("defines stricter budgets for guest radio than for XOT", () => {
    expect(transportPolicy("xot")?.maxUserDataBytes).toBe(128);
    expect(transportPolicy("meshcore")?.maxUserDataBytes).toBe(64);
    expect(transportPolicy("meshtastic")?.maxUserDataBytes).toBe(32);
    expect(transportPolicy("meshtastic")?.fastSelectAllowed).toBe(false);
  });

  it("admits an in-budget call", () => {
    const check = checkTransport("meshtastic", 20);
    expect(check.ok).toBe(true);
  });

  it("refuses an unknown transport with cause 3", () => {
    const check = checkTransport("carrier-pigeon", 1);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.clearCode.cause).toBe(3);
  });

  it("refuses an over-budget guest-radio call with cause 19", () => {
    const check = checkTransport("meshtastic", 200);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.clearCode.cause).toBe(19);
      expect(check.reason).toContain("exceeds");
    }
  });
});
