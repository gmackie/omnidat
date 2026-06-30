from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from tools.omnidat_events import append_event


ACCESS_RANK = {
    "PUBLIC": 0,
    "REGISTERED": 1,
    "OPERATOR": 2,
    "MAINTENANCE": 3,
}


def load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


def load_packet_services(data_dir: Path) -> dict[str, dict[str, Any]]:
    return {
        service["address"]: service
        for service in load_json(data_dir / "packet-services.json")
    }


def load_accounts(data_dir: Path) -> dict[str, dict[str, Any]]:
    return {
        account["account_id"]: account
        for account in load_json(data_dir / "accounts.sample.json")
    }


def list_directory(packet_services: dict[str, dict[str, Any]]) -> str:
    lines = [
        "OMNIDAT PACKET CLEARING",
        "AUTHORIZED TERMINAL SERVICE",
        "",
        "ADDR    ACCESS      SERVICE",
        "------  ----------  ------------------------------",
    ]
    for address in sorted(packet_services):
        service = packet_services[address]
        lines.append(
            f"{address}  "
            f"{service['access_class']:<10}  "
            f"{service['name']}"
        )
    lines.append("")
    return "\n".join(lines)


def start_session(
    endpoint_id: str,
    account_id: str,
    created_at: str | None = None,
) -> dict[str, Any]:
    return {
        "session_id": session_id(created_at),
        "kind": "pad",
        "endpoint_id": endpoint_id,
        "account_id": account_id,
        "status": "open",
        "remote_service": None,
        "started_at": created_at or now(),
    }


def call_service(
    session: dict[str, Any],
    address: str,
    packet_services: dict[str, dict[str, Any]],
    accounts: dict[str, dict[str, Any]],
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    if address not in packet_services:
        raise ValueError(f"unknown packet address {address}")

    service = packet_services[address]
    account = accounts[session["account_id"]]
    required = service["access_class"]
    actual = account["access_class"]
    if ACCESS_RANK[actual] < ACCESS_RANK[required]:
        raise PermissionError(f"{required} access required for {address}")

    connected = dict(session)
    connected["remote_service"] = address
    connected["status"] = "connected"
    connected["connected_at"] = created_at or now()
    connected["service_name"] = service["name"]
    emit(log_path, "session.started", connected, created_at=created_at)
    return connected


def clear_session(
    session: dict[str, Any],
    clear_reason: str,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    cleared = dict(session)
    cleared["status"] = "cleared"
    cleared["clear_reason"] = clear_reason
    cleared["ended_at"] = created_at or now()
    emit(log_path, "session.ended", cleared, created_at=created_at)
    return cleared


def session_id(created_at: str | None = None) -> str:
    stamp = (created_at or now())[:19].replace("-", "").replace(":", "").replace("T", "-")
    return f"SESS-{stamp}"


def emit(
    log_path: Path | None,
    event_type: str,
    payload: dict[str, Any],
    created_at: str | None = None,
) -> None:
    if log_path is not None:
        append_event(log_path, event_type, "packet-clearing", payload, created_at=created_at)


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def main() -> int:
    parser = argparse.ArgumentParser(description="OMNIDAT Packet Clearing simulator.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    parser.add_argument("--endpoint", default="PAD-01")
    parser.add_argument("--account", default="ACCT-GUEST")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("directory")

    call_parser = subparsers.add_parser("call")
    call_parser.add_argument("address")
    call_parser.add_argument("--clear-reason", default="user-cleared")

    args = parser.parse_args()
    packet_services = load_packet_services(args.data_dir)
    accounts = load_accounts(args.data_dir)

    if args.command == "directory":
        print(list_directory(packet_services))
        return 0

    session = start_session(args.endpoint, args.account)
    connected = call_service(session, args.address, packet_services, accounts, log_path=args.log)
    cleared = clear_session(connected, args.clear_reason, log_path=args.log)
    print(json.dumps(cleared, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
