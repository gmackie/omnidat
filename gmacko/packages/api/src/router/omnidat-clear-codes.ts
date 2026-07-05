// X.25 clear cause and diagnostic code points per docs/protocol-fidelity.md.
// A packet call always clears with an explicit cause; there are no silent
// failures. Codes are stored as integers on omnidatPacketSession.

export type ClearOutcome =
  | "normal"
  | "not-obtainable"
  | "access-barred"
  | "out-of-order"
  | "busy"
  | "congestion";

export type ClearCode = {
  outcome: ClearOutcome;
  signal: string;
  cause: number;
  diagnostic: number;
};

export const OMNIDAT_CLEAR_CODES: Record<ClearOutcome, ClearCode> = {
  normal: { outcome: "normal", signal: "DTE", cause: 0, diagnostic: 0 },
  "not-obtainable": { outcome: "not-obtainable", signal: "NP", cause: 13, diagnostic: 67 },
  "access-barred": { outcome: "access-barred", signal: "NA", cause: 11, diagnostic: 70 },
  "out-of-order": { outcome: "out-of-order", signal: "DER", cause: 9, diagnostic: 0 },
  busy: { outcome: "busy", signal: "OCC", cause: 1, diagnostic: 0 },
  congestion: { outcome: "congestion", signal: "NC", cause: 5, diagnostic: 71 },
};

export function renderClearCode(code: ClearCode): string {
  return `CLR ${code.signal} C:${code.cause} D:${code.diagnostic}`;
}

// Map a directory service status (or its absence) to a clear outcome. A
// missing address is not-obtainable (13); a suspended/barred service is
// access-barred (11); a down service is out-of-order (9); an up service
// clears normally (0).
export function clearCodeForService(
  service: { status?: string; reachable?: boolean } | undefined,
): ClearCode {
  if (!service) return OMNIDAT_CLEAR_CODES["not-obtainable"];
  const status = service.status ?? "up";
  if (status === "suspended" || status === "barred" || status === "revoked") {
    return OMNIDAT_CLEAR_CODES["access-barred"];
  }
  if (status === "down" || service.reachable === false) {
    return OMNIDAT_CLEAR_CODES["out-of-order"];
  }
  if (status === "busy") return OMNIDAT_CLEAR_CODES.busy;
  return OMNIDAT_CLEAR_CODES.normal;
}
