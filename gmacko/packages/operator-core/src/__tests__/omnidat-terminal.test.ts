import { describe, expect, it } from "vitest";

import { attractFrames, attractStreamOnce } from "../omnidat-attract";
import {
  connectServiceScreen,
  renderServiceVerb,
} from "../omnidat-terminal";
import { renderVt100Text } from "../vt100";

const MILIWAYS = "311088020501";

describe("interactive service sessions", () => {
  it("connects to a known service and lists its verbs", () => {
    const screen = connectServiceScreen(MILIWAYS);
    expect(screen.status).toBe("ok");
    expect(screen.ended).toBe(false);
    expect(screen.text).toContain("MILIWAYS ORDER ENTRY");
    expect(screen.text).toContain("MENU");
    // The page is a real VT100 byte stream with cursor addressing.
    expect(screen.page).toContain("\x1b[");
  });

  it("clears the terminal for an unknown address with an honest cause", () => {
    const screen = connectServiceScreen("311088099999");
    expect(screen.status).toBe("cleared");
    expect(screen.ended).toBe(true);
    expect(screen.text).toContain("CLR NP C:13 D:67");
  });

  it("renders the Miliways menu with items and prices", () => {
    const screen = renderServiceVerb({ x121: MILIWAYS, verb: "MENU", args: [] });
    expect(screen.text).toContain("NOODLE CUP");
    expect(screen.text).toContain("MILIWAYS ORDER ENTRY");
  });

  it("quotes an order total in ShadyBucks", () => {
    const screen = renderServiceVerb({
      x121: MILIWAYS,
      verb: "QUOTE",
      args: ["NOODLE-CUP", "TEA-THERMOS"],
    });
    expect(screen.status).toBe("ok");
    // 7 + 4 = 11 SB
    expect(screen.text).toContain("TOTAL   11 SB");
  });

  it("confirms an order with a deterministic reference", () => {
    const a = renderServiceVerb({ x121: MILIWAYS, verb: "ORDER.CREATE", args: ["NOODLE-CUP"] });
    const b = renderServiceVerb({ x121: MILIWAYS, verb: "ORDER.CREATE", args: ["NOODLE-CUP"] });
    expect(a.status).toBe("ok");
    expect(a.text).toContain("ORDER CONFIRMED");
    // Deterministic: same items → same order id, so recordings replay exactly.
    expect(a.text).toBe(b.text);
    expect(a.text).toMatch(/ORDER MW-[0-9A-Z]{6}/);
  });

  it("refuses to order an 86'd item", () => {
    const screen = renderServiceVerb({ x121: MILIWAYS, verb: "ORDER.CREATE", args: ["NIGHT-PLATE"] });
    expect(screen.status).toBe("error");
    expect(screen.text).toContain("86'D");
  });

  it("clears the session on CLEAR", () => {
    const screen = renderServiceVerb({ x121: MILIWAYS, verb: "CLEAR", args: [] });
    expect(screen.ended).toBe(true);
    expect(screen.text).toContain("SESSION CLEARED");
  });

  it("echoes generic-service verbs against their contract", () => {
    const screen = renderServiceVerb({ x121: "311088010110", verb: "DIR", args: ["CAMP"] });
    expect(screen.status).toBe("ok");
    expect(screen.text).toContain("ACCEPTED");
  });
});

describe("attract mode (screensaver)", () => {
  it("produces a non-trivial paced frame sequence", () => {
    const frames = attractFrames();
    expect(frames.length).toBeGreaterThan(30);
    for (const f of frames) {
      expect(f.ms).toBeGreaterThan(0);
      expect(typeof f.bytes).toBe("string");
    }
  });

  it("is deterministic — identical frames every run", () => {
    expect(attractStreamOnce()).toBe(attractStreamOnce());
  });

  it("renders a coherent screen when flattened through the emulator", () => {
    const text = renderVt100Text(attractStreamOnce());
    expect(text).toContain("OMNIDAT");
  });

  it("resets and homes the cursor so a serial loop starts clean", () => {
    const stream = attractStreamOnce();
    expect(stream.startsWith("\x1bc")).toBe(true); // RIS
    expect(stream.endsWith("\x1b[H")).toBe(true); // home
  });
});
