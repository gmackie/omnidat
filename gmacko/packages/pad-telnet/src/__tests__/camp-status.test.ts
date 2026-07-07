import { describe, expect, it } from "vitest";

import { isStatusBoard, normalizeStatusPost, statusHelp } from "../camp-status.js";

describe("camp status board", () => {
  it("recognizes the status board by id", () => {
    expect(isStatusBoard("STATUS")).toBe(true);
    expect(isStatusBoard("status")).toBe(true);
    expect(isStatusBoard("GEN")).toBe(false);
  });

  it("lists the standard vocabulary in help", () => {
    const help = statusHelp();
    expect(help).toContain("OPEN");
    expect(help).toContain("NEED ICE");
    expect(help).toContain("QUIET HOURS");
  });

  it("normalizes a bare known code", () => {
    const n = normalizeStatusPost("open");
    expect(n).toMatchObject({ code: "OPEN", detail: "", known: true, formatted: "OPEN" });
  });

  it("splits a known code from its detail", () => {
    const n = normalizeStatusPost("need ice tent 14");
    expect(n.code).toBe("NEED ICE");
    expect(n.detail).toBe("tent 14");
    expect(n.formatted).toBe("NEED ICE — tent 14");
  });

  it("greedily matches the longest multi-word code", () => {
    expect(normalizeStatusPost("radio operator available at hab 3").code).toBe(
      "RADIO OPERATOR AVAILABLE",
    );
    expect(normalizeStatusPost("workshop at 1600").formatted).toBe("WORKSHOP AT — 1600");
  });

  it("passes unknown text through verbatim (never rejects a shout)", () => {
    const n = normalizeStatusPost("dogs loose near the mesh tower");
    expect(n.known).toBe(false);
    expect(n.code).toBeNull();
    expect(n.formatted).toBe("dogs loose near the mesh tower");
  });
});
