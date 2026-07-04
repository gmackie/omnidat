from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any, Callable
from urllib.request import Request, urlopen

from tools.omnidat_events import append_event
from tools.omnidat_journal import JournalStore


Transport = Callable[[Request], Any]

EMPTY_REPORT = {
    "applied": 0,
    "duplicate": 0,
    "rejectedStale": 0,
    "quarantined": 0,
    "highWatermark": 0,
    "authority": None,
}


def entry_to_wire(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "seq": entry["seq"],
        "eventId": entry["event_id"],
        "epoch": entry["epoch"],
        "opType": entry["op_type"],
        "payload": entry["payload"],
        "idempotencyKey": entry["idempotency_key"],
        "payloadChecksum": entry["payload_checksum"],
        "recordedAt": entry["recorded_at"],
    }


def render_reconciliation_report(report: dict[str, Any]) -> str:
    authority = report.get("authority") or {}
    lines = [
        "OMNIDAT SYNC RECONCILIATION",
        f"APPLIED: {report.get('applied', 0)}",
        f"DUPLICATE: {report.get('duplicate', 0)}",
        f"REJECTED STALE: {report.get('rejectedStale', 0)}",
        f"QUARANTINED: {report.get('quarantined', 0)}",
        f"HIGH WATERMARK: {report.get('highWatermark', 0)}",
    ]
    if authority:
        lines.append(
            f"AUTHORITY: {str(authority.get('holder', 'unknown')).upper()} "
            f"(EPOCH {authority.get('epoch', 0)})"
        )
    lines.append("")
    return "\n".join(lines)


class SyncClient:
    """Store-and-forward sync between a field kit journal and the cloud.

    Pushes unpushed journal entries to ``omnidat.syncPush`` and pulls other
    sources' tails from ``omnidat.syncPull``. A transport failure leaves
    entries unpushed; the journal keeps appending locally and the tail drains
    on the next successful session.
    """

    def __init__(
        self,
        store: JournalStore,
        base_url: str | None = None,
        token: str | None = None,
        event_id: str | None = None,
        transport: Transport | None = None,
        apply_entry: Callable[[dict[str, Any]], None] | None = None,
        event_log: Path | None = None,
    ) -> None:
        self.store = store
        self.base_url = (base_url or os.environ.get("OMNIDAT_SYNC_TARGET", "")).rstrip("/")
        self.token = token or os.environ.get("OMNIDAT_SYNC_TOKEN", "")
        self.event_id = event_id
        self.transport = transport or urlopen
        self.apply_entry = apply_entry
        self.event_log = event_log

    def _call(self, procedure: str, payload: dict[str, Any]) -> dict[str, Any]:
        request = Request(
            f"{self.base_url}/api/trpc/{procedure}",
            data=json.dumps({"json": payload}).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        with self.transport(request) as response:
            decoded = json.loads(response.read().decode("utf-8"))
        return decoded["result"]["data"]["json"]

    def push(self) -> dict[str, Any]:
        entries = self.store.unpushed()
        if not entries:
            return {"status": "ok", "report": dict(EMPTY_REPORT), "pushed": 0}
        try:
            report = self._call(
                "omnidat.syncPush",
                {
                    "sourceId": self.store.source_id,
                    "syncToken": self.token,
                    "entries": [entry_to_wire(entry) for entry in entries],
                },
            )
        except (OSError, ValueError, KeyError) as error:
            return {"status": "error", "error": str(error), "pushed": 0}
        self.store.mark_pushed([entry["seq"] for entry in entries])
        return {"status": "ok", "report": report, "pushed": len(entries)}

    def pull(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "sourceId": self.store.source_id,
            "syncToken": self.token,
            "watermarks": self.store.watermarks(),
        }
        if self.event_id:
            payload["eventId"] = self.event_id
        try:
            result = self._call("omnidat.syncPull", payload)
        except (OSError, ValueError, KeyError) as error:
            return {"status": "error", "error": str(error), "pulled": 0}

        entries = result.get("entries", [])
        max_seq_by_source: dict[str, int] = {}
        for entry in entries:
            if self.apply_entry:
                self.apply_entry(entry)
            source_id = entry.get("sourceId", "")
            if source_id:
                max_seq_by_source[source_id] = max(
                    max_seq_by_source.get(source_id, 0), int(entry.get("seq", 0))
                )
        for source_id, seq in max_seq_by_source.items():
            self.store.set_watermark(source_id, seq)

        authority = result.get("authority")
        if authority and self.event_id:
            self.store.set_authority(
                self.event_id,
                str(authority.get("holderSourceId") or authority.get("holder")),
                int(authority.get("epoch", 0)),
            )
        return {
            "status": "ok",
            "pulled": len(entries),
            "authority": authority,
        }

    def sync_once(self) -> dict[str, Any]:
        push_result = self.push()
        pull_result = self.pull()
        session = {"push": push_result, "pull": pull_result}
        if self.event_log:
            report = push_result.get("report") or dict(EMPTY_REPORT)
            append_event(
                self.event_log,
                "sync.session",
                self.store.source_id,
                {
                    "push_status": push_result["status"],
                    "pull_status": pull_result["status"],
                    "applied": report.get("applied", 0),
                    "duplicate": report.get("duplicate", 0),
                    "rejected_stale": report.get("rejectedStale", 0),
                    "quarantined": report.get("quarantined", 0),
                    "pulled": pull_result.get("pulled", 0),
                },
            )
        return session

    def sync_loop(
        self,
        interval: int = 15,
        max_backoff: int = 300,
        iterations: int | None = None,
    ) -> None:
        delay = interval
        completed = 0
        while iterations is None or completed < iterations:
            session = self.sync_once()
            failed = (
                session["push"]["status"] != "ok"
                or session["pull"]["status"] != "ok"
            )
            delay = min(delay * 2, max_backoff) if failed else interval
            completed += 1
            if iterations is not None and completed >= iterations:
                break
            time.sleep(delay)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync the OMNIDAT field kit journal.")
    parser.add_argument("--db", default="build/field-kit-journal.db", type=Path)
    parser.add_argument("--source-id", default=None)
    parser.add_argument("--event-id", default=None)
    parser.add_argument("--event-log", default=None, type=Path)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("push")
    subparsers.add_parser("pull")
    subparsers.add_parser("once")
    loop_parser = subparsers.add_parser("loop")
    loop_parser.add_argument("--interval", default=15, type=int)

    args = parser.parse_args()
    store = JournalStore(args.db, source_id=args.source_id)
    client = SyncClient(
        store,
        event_id=args.event_id,
        event_log=args.event_log,
    )
    try:
        if args.command == "push":
            result = client.push()
            print(render_reconciliation_report(result.get("report") or EMPTY_REPORT))
            print(json.dumps(result, sort_keys=True, default=str))
            return 0 if result["status"] == "ok" else 1
        if args.command == "pull":
            result = client.pull()
            print(json.dumps(result, sort_keys=True, default=str))
            return 0 if result["status"] == "ok" else 1
        if args.command == "once":
            session = client.sync_once()
            print(json.dumps(session, sort_keys=True, default=str))
            ok = session["push"]["status"] == "ok" and session["pull"]["status"] == "ok"
            return 0 if ok else 1
        client.sync_loop(interval=args.interval)
        return 0
    finally:
        store.close()


if __name__ == "__main__":
    raise SystemExit(main())
