// Transport adapters behind the packet-call interface. Each access transport
// carries a policy: whether it is permitted, its call-user-data budget, and
// its access class. Guest radio (Meshtastic) is strictest; managed radio
// (MeshCore) is bounded; XOT and POTS are rich. A call that violates its
// transport's budget clears with an honest X.25 cause rather than truncating
// silently. See docs/protocol-fidelity.md and docs/field-office-network-plan.md.

import type { ClearCode } from "./omnidat-clear-codes";
import { OMNIDAT_CLEAR_CODES } from "./omnidat-clear-codes";

export type TransportPolicy = {
  transport: string;
  kind: "terminal" | "modem" | "radio-managed" | "radio-guest" | "wifi";
  accessClass: "PUBLIC" | "REGISTERED" | "OPERATOR";
  maxUserDataBytes: number;
  fastSelectAllowed: boolean;
};

export const TRANSPORT_POLICIES: Record<string, TransportPolicy> = {
  xot: {
    transport: "xot",
    kind: "terminal",
    accessClass: "PUBLIC",
    maxUserDataBytes: 128,
    fastSelectAllowed: true,
  },
  "pots-modem": {
    transport: "pots-modem",
    kind: "modem",
    accessClass: "PUBLIC",
    maxUserDataBytes: 128,
    fastSelectAllowed: true,
  },
  "wifi-terminal": {
    transport: "wifi-terminal",
    kind: "wifi",
    accessClass: "REGISTERED",
    maxUserDataBytes: 128,
    fastSelectAllowed: true,
  },
  meshcore: {
    transport: "meshcore",
    kind: "radio-managed",
    accessClass: "REGISTERED",
    maxUserDataBytes: 64,
    fastSelectAllowed: true,
  },
  meshtastic: {
    transport: "meshtastic",
    kind: "radio-guest",
    accessClass: "PUBLIC",
    maxUserDataBytes: 32,
    fastSelectAllowed: false,
  },
  // CC Camp 2027 / ToorCamp 2028: meshtastic guest for European rehearsal, meshcore for managed
};

export function transportPolicy(transport: string): TransportPolicy | undefined {
  return TRANSPORT_POLICIES[transport];
}

export type TransportCheck =
  | { ok: true; policy: TransportPolicy }
  | { ok: false; clearCode: ClearCode; reason: string };

// Validate a packet call against its transport budget. An unknown transport or
// an over-budget call is refused with an honest clear cause (cause 3, facility
// refused, for an unknown transport; cause 19, local procedure error / packet
// too long, for an over-budget call).
export function checkTransport(
  transport: string,
  userDataBytes: number,
): TransportCheck {
  const policy = transportPolicy(transport);
  if (!policy) {
    return {
      ok: false,
      clearCode: { outcome: "not-obtainable", signal: "NP", cause: 3, diagnostic: 65 },
      reason: `unknown transport ${transport}`,
    };
  }
  if (userDataBytes > policy.maxUserDataBytes) {
    return {
      ok: false,
      clearCode: { outcome: "not-obtainable", signal: "NP", cause: 19, diagnostic: 39 },
      reason: `call user data ${userDataBytes}B exceeds ${policy.transport} budget ${policy.maxUserDataBytes}B`,
    };
  }
  return { ok: true, policy };
}

export const NORMAL_CLEAR = OMNIDAT_CLEAR_CODES.normal;
