from __future__ import annotations

import argparse
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable


class JournalAuthorityError(RuntimeError):
    pass


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def payload_checksum(payload: dict[str, Any]) -> str:
    import hashlib

    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )
    return hashlib.sha256(encoded).hexdigest()


class JournalWriter:
    """Binds a journal store to one event so writers only supply op payloads."""

    def __init__(self, store: "JournalStore", event_id: str) -> None:
        self.store = store
        self.event_id = event_id

    def append(self, op_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self.store.append(self.event_id, op_type, payload)


class JournalStore:
    def __init__(self, path: Path, source_id: str | None = None):
        self.path = path
        self.source_id = source_id or os.environ.get("OMNIDAT_SOURCE_ID", "field-kit-01")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("pragma journal_mode = wal")
        self._conn.execute("pragma foreign_keys = on")
        self._create_schema()

    def close(self) -> None:
        self._conn.close()

    def _create_schema(self) -> None:
        self._conn.executescript(
            """
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
        )
        self._conn.commit()

    def set_authority(self, event_id: str, holder: str, epoch: int) -> None:
        self._conn.execute(
            """
            insert into authority_cache (event_id, holder, epoch, fetched_at)
            values (?, ?, ?, ?)
            on conflict(event_id) do update set
              holder = excluded.holder,
              epoch = excluded.epoch,
              fetched_at = excluded.fetched_at
            """,
            (event_id, holder, epoch, now_iso()),
        )
        self._conn.commit()

    def current_epoch(self, event_id: str) -> int:
        row = self._conn.execute(
            "select epoch from authority_cache where event_id = ?",
            (event_id,),
        ).fetchone()
        return int(row["epoch"]) if row else 0

    def current_holder(self, event_id: str) -> str | None:
        row = self._conn.execute(
            "select holder from authority_cache where event_id = ?",
            (event_id,),
        ).fetchone()
        return str(row["holder"]) if row else None

    def watermark(self, source_id: str) -> int:
        row = self._conn.execute(
            "select last_pulled_seq from sync_watermark where source_id = ?",
            (source_id,),
        ).fetchone()
        return int(row["last_pulled_seq"]) if row else 0

    def watermarks(self) -> dict[str, int]:
        rows = self._conn.execute(
            "select source_id, last_pulled_seq from sync_watermark"
        ).fetchall()
        return {row["source_id"]: int(row["last_pulled_seq"]) for row in rows}

    def set_watermark(self, source_id: str, seq: int) -> None:
        self._conn.execute(
            """
            insert into sync_watermark (source_id, last_pulled_seq, last_sync_at)
            values (?, ?, ?)
            on conflict(source_id) do update set
              last_pulled_seq = excluded.last_pulled_seq,
              last_sync_at = excluded.last_sync_at
            """,
            (source_id, seq, now_iso()),
        )
        self._conn.commit()

    def append(
        self, event_id: str, op_type: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        authority = self._conn.execute(
            "select holder, epoch from authority_cache where event_id = ?",
            (event_id,),
        ).fetchone()
        if authority and authority["holder"] != self.source_id:
            raise JournalAuthorityError(
                f"{self.source_id} is not authority holder for {event_id}"
            )

        epoch = int(authority["epoch"]) if authority else 0
        recorded_at = now_iso()
        checksum = payload_checksum(payload)
        payload_text = json.dumps(payload, sort_keys=True, separators=(",", ":"))

        cursor = self._conn.execute(
            """
            insert into journal_entry (
              event_id,
              epoch,
              op_type,
              payload,
              idempotency_key,
              payload_checksum,
              recorded_at
            )
            values (?, ?, ?, ?, '', ?, ?)
            """,
            (event_id, epoch, op_type, payload_text, checksum, recorded_at),
        )
        seq = int(cursor.lastrowid)
        idempotency_key = f"{self.source_id}:{seq}"
        self._conn.execute(
            "update journal_entry set idempotency_key = ? where seq = ?",
            (idempotency_key, seq),
        )
        self._conn.commit()
        return self._entry_by_seq(seq)

    def entries(self) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "select * from journal_entry order by seq"
        ).fetchall()
        return [self._entry(row) for row in rows]

    def unpushed(self) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "select * from journal_entry where pushed_at is null order by seq"
        ).fetchall()
        return [self._entry(row) for row in rows]

    def mark_pushed(self, seqs: Iterable[int]) -> None:
        stamp = now_iso()
        for seq in seqs:
            self._conn.execute(
                "update journal_entry set pushed_at = ? where seq = ?",
                (stamp, seq),
            )
        self._conn.commit()

    def _entry_by_seq(self, seq: int) -> dict[str, Any]:
        row = self._conn.execute(
            "select * from journal_entry where seq = ?",
            (seq,),
        ).fetchone()
        if not row:
            raise KeyError(seq)
        return self._entry(row)

    def _entry(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "seq": row["seq"],
            "event_id": row["event_id"],
            "epoch": row["epoch"],
            "op_type": row["op_type"],
            "payload": json.loads(row["payload"]),
            "idempotency_key": row["idempotency_key"],
            "payload_checksum": row["payload_checksum"],
            "recorded_at": row["recorded_at"],
            "pushed_at": row["pushed_at"],
        }


class JournalWriter:
    def __init__(self, store: JournalStore, event_id: str):
        self.store = store
        self.event_id = event_id

    def append(self, op_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self.store.append(self.event_id, op_type, payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect an OMNIDAT field journal.")
    parser.add_argument("--db", default="build/field-kit-journal.db", type=Path)
    parser.add_argument("--source-id", default=None)
    subparsers = parser.add_subparsers(dest="command", required=True)

    authority_parser = subparsers.add_parser("authority")
    authority_parser.add_argument("event_id")
    authority_parser.add_argument("holder")
    authority_parser.add_argument("epoch", type=int)

    append_parser = subparsers.add_parser("append")
    append_parser.add_argument("event_id")
    append_parser.add_argument("op_type")
    append_parser.add_argument("--payload", default="{}")

    subparsers.add_parser("list")
    subparsers.add_parser("report")

    args = parser.parse_args()
    store = JournalStore(args.db, source_id=args.source_id)
    try:
        if args.command == "authority":
            store.set_authority(args.event_id, args.holder, args.epoch)
            print(
                json.dumps(
                    {
                        "event_id": args.event_id,
                        "holder": args.holder,
                        "epoch": args.epoch,
                    },
                    sort_keys=True,
                )
            )
            return 0
        if args.command == "append":
            entry = store.append(args.event_id, args.op_type, json.loads(args.payload))
            print(json.dumps(entry, sort_keys=True))
            return 0
        if args.command == "list":
            print(json.dumps(store.entries(), sort_keys=True))
            return 0
        print(
            json.dumps(
                {
                    "entries": len(store.entries()),
                    "source_id": store.source_id,
                    "unpushed": len(store.unpushed()),
                },
                sort_keys=True,
            )
        )
        return 0
    finally:
        store.close()


if __name__ == "__main__":
    raise SystemExit(main())
