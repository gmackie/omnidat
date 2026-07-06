// Interactive X.25 service sessions rendered as full-screen VT100 pages.
//
// When an operator CALLs a service from the terminal, the service answers with
// a cursor-addressed screen (menus, order forms, status boards) instead of a
// scrolling transcript. Every renderer is a pure, deterministic function of its
// inputs — no clock, no randomness — so a recorded session replays byte-exact
// (see the session-recording path). Screens are composed with Vt100Page, so
// they animate on real DEC hardware and fold gracefully in our emulator.

import { getOperationalState, omnidatFoodMenu } from "./omnidat";
import { VT, Vt100Page, renderVt100Text, sgr } from "./vt100";

export interface ServiceScreen {
  /** Raw VT100 byte stream for the full screen. */
  page: string;
  /** Plain-text snapshot (for the audit transcript / evidence). */
  text: string;
  status: "ok" | "error" | "cleared";
  /** True once the session has cleared and the terminal returns to the PAD. */
  ended: boolean;
}

/** Small deterministic hash → short reference (no clock, no RNG). */
function ref(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}-${(h >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6)}`;
}

function service(x121: string) {
  return getOperationalState().services.find((s) => s.x121 === x121);
}

function finish(page: Vt100Page, status: ServiceScreen["status"], ended = false): ServiceScreen {
  const rendered = page.toString();
  return { page: rendered, text: renderVt100Text(rendered), status, ended };
}

/** Connect banner + verb menu for a service (the screen CALL lands on). */
export function connectServiceScreen(x121: string): ServiceScreen {
  const svc = service(x121);
  const page = new Vt100Page().clear().hideCursor();
  if (!svc) {
    page
      .bar(1, "OMNIDAT X.25", "CLEARED")
      .center(11, sgr(`NO SUCH ADDRESS ${x121}`, 1))
      .center(13, "CLR NP C:13 D:67")
      .center(23, "PRESS RETURN TO RETURN TO PAD");
    return finish(page, "cleared", true);
  }
  page
    .bar(1, `OMNIDAT · ${svc.name.toUpperCase()}`, `DTE ${x121}`)
    .at(3, 3, `OWNER  ${svc.owner}`, 2)
    .at(4, 3, `STATUS ${svc.status.toUpperCase()}`, svc.status === "up" ? 32 : 1)
    .box(6, 3, 46, 4 + svc.verbs.length, "VERBS")
    .at(7, 6, "TYPE A VERB THEN RETURN:", 1);
  svc.verbs.forEach((v, i) => {
    page.at(9 + i, 6, `${v.name.padEnd(14, " ")} ${v.description}`);
  });
  page
    .at(23, 3, "CLEAR = HANG UP", 2)
    .raw(VT.showCursor);
  return finish(page, "ok");
}

// ---- Miliways (food-service) interactive flow -------------------------

function milliwaysMenu(): ServiceScreen {
  const page = new Vt100Page().clear().hideCursor();
  page
    .bar(1, "MILIWAYS ORDER ENTRY", "X.29 MENU")
    .box(3, 4, 52, 4 + omnidatFoodMenu.length, "TONIGHT")
    .at(4, 7, "ITEM                         SB   STATUS", 4);
  omnidatFoodMenu.forEach((item, i) => {
    const line = `${item.name.toUpperCase().padEnd(26, " ")} ${String(item.priceShadyBucks).padStart(4, " ")}   ${item.available ? "OPEN" : "86'D"}`;
    page.at(6 + i, 7, line, item.available ? 0 : 2);
  });
  page
    .at(20, 4, "QUOTE <ITEM...>       PRICE AN ORDER", 0)
    .at(21, 4, "ORDER.CREATE <ITEM...> PLACE IT", 0)
    .at(22, 4, "MENU  ·  CLEAR", 2)
    .raw(VT.showCursor);
  return finish(page, "ok");
}

function milliwaysQuote(itemIds: string[]): ServiceScreen {
  const page = new Vt100Page().clear().hideCursor();
  const items = itemIds
    .map((id) => omnidatFoodMenu.find((m) => m.itemId.toUpperCase() === id.toUpperCase()))
    .filter((m): m is (typeof omnidatFoodMenu)[number] => Boolean(m));
  page.bar(1, "MILIWAYS · QUOTE", "X.29");
  if (items.length === 0) {
    page
      .center(11, sgr("NO SUCH ITEM", 1))
      .center(13, "QUOTE <ITEM-ID> [ITEM-ID...]")
      .raw(VT.showCursor);
    return finish(page, "error");
  }
  let total = 0;
  items.forEach((item, i) => {
    total += item.priceShadyBucks;
    page.at(4 + i, 5, `${item.name.toUpperCase().padEnd(28, " ")} ${String(item.priceShadyBucks).padStart(4, " ")} SB`);
  });
  const wait = 3 + items.length * 2; // deterministic estimate
  page
    .at(6 + items.length, 5, "─".repeat(36), 2)
    .at(7 + items.length, 5, `TOTAL ${String(total).padStart(4, " ")} SB`, 1)
    .at(8 + items.length, 5, `EST WAIT ~${wait} MIN`, 2)
    .at(22, 5, "ORDER.CREATE TO CONFIRM · MENU · CLEAR", 2)
    .raw(VT.showCursor);
  return finish(page, "ok");
}

function milliwaysOrder(itemIds: string[]): ServiceScreen {
  const page = new Vt100Page().clear().hideCursor();
  const items = itemIds
    .map((id) => omnidatFoodMenu.find((m) => m.itemId.toUpperCase() === id.toUpperCase()))
    .filter((m): m is (typeof omnidatFoodMenu)[number] => Boolean(m));
  page.bar(1, "MILIWAYS · ORDER", "X.29");
  const unavailable = items.filter((m) => !m.available);
  if (items.length === 0 || unavailable.length > 0) {
    page
      .center(11, sgr(items.length === 0 ? "NO SUCH ITEM" : "ITEM 86'D — NOT AVAILABLE", 1))
      .center(13, unavailable.map((m) => m.name.toUpperCase()).join(", ") || "ORDER.CREATE <ITEM-ID...>")
      .raw(VT.showCursor);
    return finish(page, "error");
  }
  const total = items.reduce((sum, m) => sum + m.priceShadyBucks, 0);
  const orderId = ref("MW", items.map((m) => m.itemId).sort().join("|"));
  page
    .box(3, 6, 46, 7 + items.length, "ORDER CONFIRMED")
    .at(4, 9, `ORDER ${orderId}`, 1)
    .at(5, 9, "WINDOW  PACKET WINDOW 3", 0);
  items.forEach((item, i) => {
    page.at(7 + i, 9, `${item.name.toUpperCase().padEnd(26, " ")} ${String(item.priceShadyBucks).padStart(4, " ")} SB`);
  });
  page
    .at(8 + items.length, 9, `TOTAL ${String(total).padStart(4, " ")} SB`, 1)
    .center(20, sgr(" ORDER.STATUS " + orderId + " TO TRACK ", 7))
    .at(22, 6, "MENU · CLEAR", 2)
    .raw(VT.showCursor);
  return finish(page, "ok");
}

function milliwaysStatus(orderId: string): ServiceScreen {
  const page = new Vt100Page().clear().hideCursor();
  // Deterministic state derived from the id so replays match.
  const stage = (orderId.length + orderId.charCodeAt(orderId.length - 1)) % 3;
  const stages = ["QUEUED", "ON THE LINE", "READY AT WINDOW 3"];
  page
    .bar(1, "MILIWAYS · STATUS", orderId.toUpperCase())
    .box(5, 8, 40, 6, "TICKET")
    .at(7, 11, `ORDER  ${orderId.toUpperCase()}`, 1)
    .at(8, 11, `STATE  ${stages[stage]}`, stage === 2 ? 32 : 0)
    .at(9, 11, `LINE   ${stage + 1} OF 3`, 2)
    .at(22, 8, "MENU · CLEAR", 2)
    .raw(VT.showCursor);
  return finish(page, "ok");
}

/**
 * Render one verb inside an active service session. `x121` selects the service;
 * unknown services fall back to a generic verb-echo screen. Returns the full
 * VT100 page, a plain-text snapshot for audit, and whether the session ended.
 */
export function renderServiceVerb(input: {
  x121: string;
  verb: string;
  args: string[];
}): ServiceScreen {
  const svc = service(input.x121);
  const verb = input.verb.toUpperCase();
  if (verb === "CLEAR" || verb === "CLR" || verb === "BYE") {
    const page = new Vt100Page()
      .clear()
      .center(12, sgr("SESSION CLEARED", 1))
      .center(14, "CLR DTE C:0 D:0");
    return finish(page, "cleared", true);
  }
  if (!svc) return connectServiceScreen(input.x121);

  // Miliways interactive flow.
  if (svc.category === "food") {
    if (verb === "MENU") return milliwaysMenu();
    if (verb === "QUOTE") return milliwaysQuote(input.args);
    if (verb === "ORDER.CREATE" || verb === "ORDER") return milliwaysOrder(input.args);
    if (verb === "ORDER.STATUS" || verb === "STATUS") {
      return milliwaysStatus(input.args[0] ?? "MW-000000");
    }
  }

  // Generic service: echo the verb against the service's declared contract.
  const known = svc.verbs.find((v) => v.name.toUpperCase() === verb);
  const page = new Vt100Page().clear().hideCursor();
  page.bar(1, `OMNIDAT · ${svc.name.toUpperCase()}`, verb);
  if (!known) {
    page
      .center(11, sgr(`UNKNOWN VERB ${verb}`, 1))
      .center(13, `VERBS ${svc.verbs.map((v) => v.name).join(", ")}`)
      .raw(VT.showCursor);
    return finish(page, "error");
  }
  page
    .at(4, 5, known.description, 1)
    .at(6, 5, `INPUTS  ${known.inputs.join(", ") || "—"}`)
    .at(7, 5, `OUTPUTS ${known.outputs.join(", ") || "—"}`)
    .at(9, 5, `ARGS    ${input.args.join(" ") || "(none)"}`, 2)
    .at(11, 5, sgr(" ACCEPTED ", 7))
    .raw(VT.showCursor);
  return finish(page, "ok");
}
