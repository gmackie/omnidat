from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


DEFAULT_SOURCE_ID = "field-kit-01"

SCHEMA = """
create table if not exists journal_entry (
  seq integer primary key autoincrement,
  event_id text not null,
  epoch integer not null,
  op_type text not null,
  payload text not null,
  idempotency_key text not null unique,
  payload_checksum text not null,
  recorded_at text not null,
  pushed_at text
);
create table if not exists sync_watermark (
  source_id text primary key,
  last_pulled_seq integer not null default 0,
  last_sync_at text
);
create table if not exists authority_cache (
  event_id text primary key,
  holder text not null,
  epoch integer not null,
  fetched_at text not null
);
"""


class JournalAuthorityError(RuntimeError):
    """Raised when a write is attempted while another source holds authority."""


def payload_checksum(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


class JournalStore:
    """Append-only field kit journal backed by SQLite in WAL mode.

    Every event-scoped write lands here first; local state remains the read
    path and the journal is the sync path. The ``authority_cache`` ``holder``
    column stores the holder's *source id* (for example ``field-kit-01`` or
    ``cloud``), so stale-epoch writes are rejected at the writer rather than
    only at the receiver.
    """

    def __init__(self, path: Path | str, source_id: str | None = None) -> None:
        self.path = Path(path)
        self.source_id = (
            source_id
            or os.environ.get("OMNIDAT_SOURCE_ID")
            or DEFAULT_SOURCE_ID
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(self.path)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("pragma journal_mode = wal")
        self._connection.execute("pragma foreign_keys = on")
        self._connection.executescript(SCHEMA)
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    def set_authority(self, event_id: str, holder: str, epoch: int) -> None:
        with self._connection:
            self._connection.execute(
                """
                insert into authority_cache (event_id, holder, epoch, fetched_at)
                values (?, ?, ?, ?)
                on conflict (event_id) do update set
                  holder = excluded.holder,
                  epoch = excluded.epoch,
                  fetched_at = excluded.fetched_at
                """,
                (event_id, holder, epoch, _now()),
            )

    def current_epoch(self, event_id: str) -> int:
        row = self._connection.execute(
            "select epoch from authority_cache where event_id = ?", (event_id,)
        ).fetchone()
        return int(row["epoch"]) if row else 0

    def current_holder(self, event_id: str) -> str | None:
        row = self._connection.execute(
            "select holder from authority_cache where event_id = ?", (event_id,)
        ).fetchone()
        return str(row["holder"]) if row else None

    def append(
        self,
        event_id: str,
        op_type: str,
        payload: dict[str, Any],
        recorded_at: str | None = None,
    ) -> dict[str, Any]:
        holder = self.current_holder(event_id)
        if holder is not None and holder != self.source_id:
            raise JournalAuthorityError(
                f"append refused: authority for {event_id} is held by {holder}, "
                f"not {self.source_id} (stale-epoch writes are rejected at the writer)"
            )

        epoch = self.current_epoch(event_id)
        recorded_at = recorded_at or _now()
        with self._connection:
            row = self._connection.execute(
                "select coalesce(max(seq), 0) + 1 as next_seq from journal_entry"
            ).fetchone()
            seq = int(row["next_seq"])
            self._connection.execute(
                """
                insert into journal_entry (
                  seq, event_id, epoch, op_type, payload,
                  idempotency_key, payload_checksum, recorded_at, pushed_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, null)
                """,
                (
                    seq,
                    event_id,
                    epoch,
                    op_type,
                    json.dumps(payload, sort_keys=True),
                    f"{self.source_id}:{seq}",
                    payload_checksum(payload),
                    recorded_at,
                ),
            )
        return self._entry(seq)

    def _entry(self, seq: int) -> dict[str, Any]:
        row = self._connection.execute(
            "select * from journal_entry where seq = ?", (seq,)
        ).fetchone()
        return self._row_to_entry(row)

    def _row_to_entry(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "seq": int(row["seq"]),
            "event_id": row["event_id"],
            "epoch": int(row["epoch"]),
            "op_type": row["op_type"],
            "payload": json.loads(row["payload"]),
            "idempotency_key": row["idempotency_key"],
            "payload_checksum": row["payload_checksum"],
            "recorded_at": row["recorded_at"],
            "pushed_at": row["pushed_at"],
        }

    def entries(self) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "select * from journal_entry order by seq asc"
        ).fetchall()
        return [self._row_to_entry(row) for row in rows]

    def unpushed(self) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "select * from journal_entry where pushed_at is null order by seq asc"
        ).fetchall()
        return [self._row_to_entry(row) for row in rows]

    def mark_pushed(self, seqs: list[int]) -> None:
        pushed_at = _now()
        with self._connection:
            self._connection.executemany(
                "update journal_entry set pushed_at = ? where seq = ?",
                [(pushed_at, seq) for seq in seqs],
            )

    def watermark(self, source_id: str) -> int:
        row = self._connection.execute(
            "select last_pulled_seq from sync_watermark where source_id = ?",
            (source_id,),
        ).fetchone()
        return int(row["last_pulled_seq"]) if row else 0

    def watermarks(self) -> dict[str, int]:
        rows = self._connection.execute(
            "select source_id, last_pulled_seq from sync_watermark"
        ).fetchall()
        return {row["source_id"]: int(row["last_pulled_seq"]) for row in rows}

    def set_watermark(self, source_id: str, seq: int) -> None:
        with self._connection:
            self._connection.execute(
                """
                insert into sync_watermark (source_id, last_pulled_seq, last_sync_at)
                values (?, ?, ?)
                on conflict (source_id) do update set
                  last_pulled_seq = excluded.last_pulled_seq,
                  last_sync_at = excluded.last_sync_at
                """,
                (source_id, seq, _now()),
            )

    def report(self) -> dict[str, Any]:
        entries = self.entries()
        per_op: dict[str, int] = {}
        for entry in entries:
            per_op[entry["op_type"]] = per_op.get(entry["op_type"], 0) + 1
        return {
            "source_id": self.source_id,
            "total": len(entries),
            "unpushed": len(self.unpushed()),
            "per_op_type": per_op,
        }


def render_report(report: dict[str, Any]) -> str:
    lines = [
        "OMNIDAT JOURNAL REPORT",
        f"SOURCE: {report['source_id'].upper()}",
        f"ENTRIES: {report['total']}",
        f"UNPUSHED: {report['unpushed']}",
        "",
    ]
    for op_type, count in sorted(report["per_op_type"].items()):
        lines.append(f"{op_type.upper()}: {count}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect the OMNIDAT field kit journal.")
    parser.add_argument("--db", default="build/journal.db", type=Path)
    parser.add_argument("--source-id")
    subparsers = parser.add_subparsers(dest="command", required=True)

    append_parser = subparsers.add_parser("append")
    append_parser.add_argument("event_id")
    append_parser.add_argument("op_type")
    append_parser.add_argument("--payload", default="{}", help="JSON payload")

    subparsers.add_parser("list")
    subparsers.add_parser("report")

    args = parser.parse_args()
    store = JournalStore(args.db, source_id=args.source_id)
    try:
        if args.command == "append":
            entry = store.append(args.event_id, args.op_type, json.loads(args.payload))
            print(json.dumps(entry, sort_keys=True))
        elif args.command == "list":
            for entry in store.entries():
                print(json.dumps(entry, sort_keys=True))
        else:
            print(render_report(store.report()))
    finally:
        store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
