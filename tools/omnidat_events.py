from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any


SUMMARY_KEYS = {
    "calls_completed": 0,
    "busy_or_intercepts": 0,
    "pad_sessions": 0,
    "bbs_sessions": 0,
    "faxes_received": 0,
    "print_jobs": 0,
    "media_requests": 0,
    "queue_orders": 0,
    "activities_logged": 0,
    "incidents": 0,
}


def append_event(
    log_path: Path,
    event_type: str,
    source: str,
    payload: dict[str, Any],
    created_at: str | None = None,
    journal: Any | None = None,
) -> dict[str, Any]:
    created_at = created_at or datetime.now().astimezone().isoformat(timespec="seconds")
    event = {
        "event_id": next_event_id(log_path, created_at),
        "type": event_type,
        "source": source,
        "created_at": created_at,
        "payload": payload,
    }
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a") as handle:
        handle.write(json.dumps(event, sort_keys=True) + "\n")
    if journal is not None:
        journal.append(event_type, payload)
    return event


def next_event_id(log_path: Path, created_at: str) -> str:
    date_part = created_at[:10].replace("-", "")
    sequence = len(read_events(log_path)) + 1
    return f"EVT-{date_part}-{sequence:06d}"


def read_events(log_path: Path) -> list[dict[str, Any]]:
    if not log_path.exists():
        return []
    return [
        json.loads(line)
        for line in log_path.read_text().splitlines()
        if line.strip()
    ]


def summarize_events(events: list[dict[str, Any]]) -> dict[str, int]:
    summary = dict(SUMMARY_KEYS)
    for item in events:
        event_type = item.get("type")
        payload = item.get("payload", {})
        if event_type == "call.ended":
            disposition = payload.get("disposition")
            if disposition == "answered":
                summary["calls_completed"] += 1
            elif disposition in {"busy", "intercept", "maintenance"}:
                summary["busy_or_intercepts"] += 1
        elif event_type == "session.ended":
            if payload.get("kind") == "pad":
                summary["pad_sessions"] += 1
            elif payload.get("kind") == "bbs":
                summary["bbs_sessions"] += 1
        elif event_type == "fax.received":
            summary["faxes_received"] += 1
        elif event_type == "print.printed":
            summary["print_jobs"] += 1
        elif event_type == "media.request.created":
            summary["media_requests"] += 1
        elif event_type == "queue.order.accepted":
            summary["queue_orders"] += 1
        elif event_type == "activity.logged":
            summary["activities_logged"] += 1
        elif event_type == "incident.opened":
            summary["incidents"] += 1
    return summary


def render_daily_summary(date: str, summary: dict[str, int]) -> str:
    lines = [
        "OMNIDAT DAILY SUMMARY",
        "A GMACKO CORPORATION",
        "EXCHANGE 88",
        "",
        f"DATE: {date}",
        "",
        f"CALLS COMPLETED: {summary.get('calls_completed', 0)}",
        f"BUSY/INTERCEPTS: {summary.get('busy_or_intercepts', 0)}",
        f"PAD SESSIONS: {summary.get('pad_sessions', 0)}",
        f"BBS SESSIONS: {summary.get('bbs_sessions', 0)}",
        f"FAXES RECEIVED: {summary.get('faxes_received', 0)}",
        f"PRINT JOBS: {summary.get('print_jobs', 0)}",
        f"MEDIA REQUESTS: {summary.get('media_requests', 0)}",
        f"QUEUE ORDERS: {summary.get('queue_orders', 0)}",
        f"ACTIVITIES LOGGED: {summary.get('activities_logged', 0)}",
        f"INCIDENTS: {summary.get('incidents', 0)}",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Record and summarize OMNIDAT events.")
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    subparsers = parser.add_subparsers(dest="command", required=True)

    append_parser = subparsers.add_parser("append")
    append_parser.add_argument("type")
    append_parser.add_argument("source")
    append_parser.add_argument("--payload", default="{}", help="JSON payload")
    append_parser.add_argument("--created-at")

    summary_parser = subparsers.add_parser("summary")
    summary_parser.add_argument("--date")
    summary_parser.add_argument("--output", type=Path)

    args = parser.parse_args()

    if args.command == "append":
        event = append_event(
            args.log,
            args.type,
            args.source,
            json.loads(args.payload),
            created_at=args.created_at,
        )
        print(json.dumps(event, sort_keys=True))
        return 0

    events = read_events(args.log)
    summary = summarize_events(events)
    date = args.date or datetime.now().astimezone().date().isoformat()
    rendered = render_daily_summary(date, summary)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
