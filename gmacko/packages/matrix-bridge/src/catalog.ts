// The bridge's service catalog: which boards and mailbox exist on the network.
//
// This is the single source of truth for the PADs — the TS PAD fetches it via
// GET /boards instead of hard-coding addresses, and it is derived from the same
// data/packet-services.json the Python PAD reads, so both agree. An embedded
// fallback keeps the bridge useful with no catalog file present.

import { existsSync, readFileSync } from "node:fs";

export interface BoardDef {
  address: string;
  boardId: string;
  name: string;
  readClass: string;
  postClass: string;
}
export interface MailDef {
  address: string;
  name: string;
}
export interface Catalog {
  boards: BoardDef[];
  mail: MailDef | null;
}

const EMBEDDED: Catalog = {
  boards: [
    {
      address: "000401",
      boardId: "GEN",
      name: "OMNIDAT PUBLIC BOARD /GEN/",
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
export function loadCatalog(path?: string): Catalog {
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
      mail: mailSvc ? { address: String(mailSvc.address), name: String(mailSvc.name) } : EMBEDDED.mail,
    };
  } catch {
    return EMBEDDED;
  }
}
