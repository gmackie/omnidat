from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from tools.omnidat_events import append_event


def load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


def load_passports(data_dir: Path) -> dict[str, dict[str, Any]]:
    return {
        passport["passport_id"]: passport
        for passport in load_json(data_dir / "activity-passports.sample.json")
    }


def load_badges(data_dir: Path) -> list[dict[str, Any]]:
    return load_json(data_dir / "badges.sample.json")


def list_badges(data_dir: Path) -> str:
    lines = [
        "OMNIDAT ACTIVITY CLEARING",
        "MERIT BADGE REQUIREMENTS",
        "",
    ]
    for badge in load_badges(data_dir):
        lines.append(f"BADGE: {badge['badge_id']}  {badge['name'].upper()}")
        for index, requirement in enumerate(badge.get("requirements", []), start=1):
            lines.append(f"REQ {index}  {requirement}")
        lines.append("")
    return "\n".join(lines)


def log_activity(
    data_dir: Path,
    activity_dir: Path,
    passport_id: str,
    service_address: str,
    action: str,
    source: str,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    passports = load_passports(data_dir)
    if passport_id not in passports:
        raise ValueError(f"unknown passport {passport_id}")

    activity_dir.mkdir(parents=True, exist_ok=True)
    created_at = created_at or now()
    passport = passports[passport_id]
    record = {
        "activity_id": next_activity_id(activity_dir),
        "identity_kind": "passport",
        "identity_id": passport_id,
        "handle": passport["handle"],
        "service_address": service_address,
        "action": action,
        "source": source,
        "status": "cleared",
        "created_at": created_at,
    }
    append_activity_record(activity_dir, record)
    if log_path is not None:
        append_event(log_path, "activity.logged", "activity-clearing", record, created_at=created_at)
    return record


def append_activity_record(activity_dir: Path, record: dict[str, Any]) -> None:
    ledger = activity_dir / "activity-records.jsonl"
    with ledger.open("a") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")


def read_activity_records(activity_dir: Path) -> list[dict[str, Any]]:
    ledger = activity_dir / "activity-records.jsonl"
    if not ledger.exists():
        return []
    return [
        json.loads(line)
        for line in ledger.read_text().splitlines()
        if line.strip()
    ]


def next_activity_id(activity_dir: Path) -> str:
    return f"ACT-{len(read_activity_records(activity_dir)) + 1:06d}"


def render_activity_receipt(record: dict[str, Any]) -> str:
    return "\n".join(
        [
            "OMNIDAT ACTIVITY CLEARING",
            "A GMACKO CORPORATION",
            "",
            f"ACTIVITY: {record['activity_id']}",
            f"IDENTITY: {record['identity_id']} {record.get('handle', '')}".rstrip(),
            f"SERVICE: {record['service_address']}",
            f"ACTION: {record['action']}",
            f"STATUS: {record['status'].upper()}",
            f"CREATED: {record['created_at']}",
            "",
            "PRESENT THIS RECEIPT FOR PASSPORT ENDORSEMENT",
            "",
        ]
    )


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def main() -> int:
    parser = argparse.ArgumentParser(description="OMNIDAT Activity Clearing.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--activity-dir", default="build/activity", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("badges")

    log_parser = subparsers.add_parser("log")
    log_parser.add_argument("passport_id")
    log_parser.add_argument("service_address")
    log_parser.add_argument("action")
    log_parser.add_argument("--source", default="packet-clearing")

    args = parser.parse_args()
    if args.command == "badges":
        print(list_badges(args.data_dir))
        return 0

    record = log_activity(
        args.data_dir,
        args.activity_dir,
        passport_id=args.passport_id,
        service_address=args.service_address,
        action=args.action,
        source=args.source,
        log_path=args.log,
    )
    print(render_activity_receipt(record))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
