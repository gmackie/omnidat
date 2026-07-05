import { describe, expect, it } from "vitest";

import {
  clearCodeForService,
  OMNIDAT_CLEAR_CODES,
  renderClearCode,
} from "./omnidat-clear-codes";

describe("OMNIDAT X.25 clear codes", () => {
  it("renders the normative CLR <signal> C:<cause> D:<diag> form", () => {
    expect(renderClearCode(OMNIDAT_CLEAR_CODES.normal)).toBe("CLR DTE C:0 D:0");
    expect(renderClearCode(OMNIDAT_CLEAR_CODES["not-obtainable"])).toBe(
      "CLR NP C:13 D:67",
    );
    expect(renderClearCode(OMNIDAT_CLEAR_CODES["access-barred"])).toBe(
      "CLR NA C:11 D:70",
    );
  });

  it("maps directory service status to honest clear outcomes", () => {
    expect(clearCodeForService(undefined).cause).toBe(13);
    expect(clearCodeForService({ status: "up" }).cause).toBe(0);
    expect(clearCodeForService({ status: "suspended" }).cause).toBe(11);
    expect(clearCodeForService({ status: "revoked" }).cause).toBe(11);
    expect(clearCodeForService({ status: "down" }).cause).toBe(9);
    expect(clearCodeForService({ status: "up", reachable: false }).cause).toBe(9);
    expect(clearCodeForService({ status: "busy" }).cause).toBe(1);
  });
});
