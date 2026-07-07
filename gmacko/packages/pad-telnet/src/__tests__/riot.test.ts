import { describe, expect, it } from "vitest";

import { parseRiotDirectory } from "../riot.js";

describe("parseRiotDirectory", () => {
  it("parses riot DIRECTORY lines into address + guild name", () => {
    const text = [
      "OMNIDAT PACKET CLEARING READY",
      "020600  RIOT DISCORD READONLY BRIDGE  OMNIDAT Field Office  discord:omnidat-field-office",
      "020601  RIOT DISCORD READONLY BRIDGE  Night Market  discord:night-market",
    ].join("\r\n");
    const entries = parseRiotDirectory(text);
    expect(entries).toEqual([
      { address: "020600", name: "OMNIDAT Field Office" },
      { address: "020601", name: "Night Market" },
    ]);
  });

  it("ignores non-directory lines (banners, blanks)", () => {
    expect(parseRiotDirectory("OMNIDAT PACKET CLEARING READY\r\n\r\n")).toEqual([]);
  });

  it("falls back to the last column when there is no discord reference", () => {
    const entries = parseRiotDirectory("020700  MIRROR  Some Guild");
    expect(entries).toEqual([{ address: "020700", name: "Some Guild" }]);
  });
});
