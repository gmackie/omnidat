import { describe, expect, it } from "vitest";

import {
  OMNIDAT_CAPABILITIES,
  OMNIDAT_ROLES,
  roleGrants,
} from "./omnidat-roles";

describe("OMNIDAT role capability matrix", () => {
  it("defines the seven H1a roles", () => {
    expect(OMNIDAT_ROLES).toEqual([
      "campsite-owner",
      "vendor-operator",
      "packet-operator",
      "noc-operator",
      "bank-operator",
      "admin",
      "auditor",
    ]);
  });

  it("grants everything to admin and mutation access to no auditor", () => {
    for (const capability of Object.keys(OMNIDAT_CAPABILITIES)) {
      expect(roleGrants("admin", capability)).toBe(true);
    }

    expect(roleGrants("auditor", "operator.read")).toBe(true);
    expect(roleGrants("auditor", "service.write")).toBe(false);
    expect(roleGrants("auditor", "role.write")).toBe(false);
  });

  it("keeps split-authority sync out of operator role capabilities", () => {
    expect(Object.keys(OMNIDAT_CAPABILITIES)).not.toContain("sync.push");
    expect(Object.keys(OMNIDAT_CAPABILITIES)).not.toContain("sync.pull");
  });
});
