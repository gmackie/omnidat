// Local board/mail catalog: the PAD's own copy of the packet directory.
//
// The canonical omnichat bridge deliberately serves no GET /boards — the
// X.121 directory is Packet Clearing (edge) knowledge, and this PAD is the
// edge. The legacy in-memory bridge still serves /boards, so the session
// tries the bridge first and falls back here; against the canonical bridge
// the fallback is the normal path.
//
// Source of truth: data/packet-services.json (set OMNIDAT_CATALOG_FILE), with
// an embedded copy of the seeded boards for standalone deploys.

import { existsSync, readFileSync } from "node:fs";

import type { Catalog, BoardDef } from "./bridge.js";

const EMBEDDED: Catalog = {
  boards: [
    {
      address: "000401",
      boardId: "GEN",
      name: "OMNIDAT PUBLIC BOARD /GEN/",
      readClass: "PUBLIC",
      postClass: "PUBLIC",
    },
    {
      address: "030040",
      boardId: "NEEDHAVE",
      name: "NEED/HAVE BOARD",
      readClass: "PUBLIC",
      postClass: "PUBLIC",
    },
    {
      address: "020010",
      boardId: "STATUS",
      name: "CAMP STATUS BOARD",
      readClass: "PUBLIC",
      postClass: "PUBLIC",
    },
  ],
  mail: { address: "000007", name: "SUBSCRIBER MAIL" },
};

interface RawService {
  address?: string;
  name?: string;
  board?: { board_id?: string; read_class?: string; post_class?: string };
}

/** Load the catalog from a packet-services.json file; fall back to embedded. */
export function localCatalog(path = process.env.OMNIDAT_CATALOG_FILE): Catalog {
  if (!path || !existsSync(path)) return EMBEDDED;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as
      | RawService[]
      | { services?: RawService[] };
    const svcs: RawService[] = Array.isArray(raw) ? raw : (raw.services ?? []);
    const boards: BoardDef[] = svcs
      .filter((s) => s?.board?.board_id)
      .map((s) => ({
        address: String(s.address),
        boardId: String(s.board!.board_id),
        name: String(s.name ?? s.address),
        readClass: s.board!.read_class ?? "PUBLIC",
        postClass: s.board!.post_class ?? "PUBLIC",
      }));
    const mailSvc = svcs.find((s) => s?.address === "000007");
    return {
      boards: boards.length ? boards : EMBEDDED.boards,
      mail: mailSvc
        ? { address: String(mailSvc.address), name: String(mailSvc.name) }
        : EMBEDDED.mail,
    };
  } catch {
    return EMBEDDED;
  }
}
