from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from tools.omnidat_events import append_event


def load_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


def save_state(state_path: Path, state: dict[str, Any]) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n")


def load_state(state_path: Path) -> dict[str, Any]:
    return load_json(state_path)


def initialize_state(catalog_path: Path, state_path: Path) -> dict[str, Any]:
    catalog = load_json(catalog_path)
    state = {
        "state": "IDLE",
        "active_request_id": None,
        "next_request_number": 1,
        "queue": [],
        "fault": None,
        "tapes": {
            tape["tape_id"]: {
                "tape_id": tape["tape_id"],
                "title": tape["title"],
                "slot": tape["slot"],
                "runtime_minutes": tape.get("runtime_minutes"),
                "rights": tape.get("rights"),
                "status": tape.get("status", "available"),
            }
            for tape in catalog
        },
    }
    save_state(state_path, state)
    return state


def create_request(
    state_path: Path,
    tape_id: str,
    source: str,
    requested_by: str,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    state = load_state(state_path)
    if tape_id not in state["tapes"]:
        raise ValueError(f"unknown tape {tape_id}")
    if state["tapes"][tape_id]["status"] != "available":
        raise RuntimeError(f"tape {tape_id} is not available")

    request_number = state["next_request_number"]
    request = {
        "request_id": f"VAULT-{request_number:06d}",
        "tape_id": tape_id,
        "source": source,
        "requested_by": requested_by,
        "status": "submitted",
        "created_at": created_at or now(),
        "operator_initials": None,
    }
    state["next_request_number"] = request_number + 1
    state["queue"].append(request)
    state["tapes"][tape_id]["status"] = "queued"
    save_state(state_path, state)
    emit(
        log_path,
        "media.request.created",
        request,
        created_at=created_at,
    )
    return request


def approve_next_request(
    state_path: Path,
    operator_initials: str,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    state = load_state(state_path)
    ensure_not_faulted(state)
    request = next((item for item in state["queue"] if item["status"] == "submitted"), None)
    if request is None:
        raise RuntimeError("no submitted Media Vault requests")

    request["status"] = "approved"
    request["operator_initials"] = operator_initials
    request["approved_at"] = created_at or now()
    save_state(state_path, state)
    emit(log_path, "media.request.approved", request, created_at=created_at)
    return request


def start_playback(
    state_path: Path,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    state = load_state(state_path)
    ensure_not_faulted(state)
    if state["active_request_id"] is not None:
        raise RuntimeError("Media Vault already has an active request")

    request = next((item for item in state["queue"] if item["status"] == "approved"), None)
    if request is None:
        raise RuntimeError("no approved Media Vault request")

    request["status"] = "playing"
    request["started_at"] = created_at or now()
    state["state"] = "PLAYING"
    state["active_request_id"] = request["request_id"]
    state["tapes"][request["tape_id"]]["status"] = "playing"
    save_state(state_path, state)
    emit(log_path, "media.playback.started", request, created_at=created_at)
    return state


def complete_playback(
    state_path: Path,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    state = load_state(state_path)
    ensure_not_faulted(state)
    active_request_id = state["active_request_id"]
    if active_request_id is None:
        raise RuntimeError("no active Media Vault request")

    request = next(item for item in state["queue"] if item["request_id"] == active_request_id)
    request["status"] = "complete"
    request["completed_at"] = created_at or now()
    state["tapes"][request["tape_id"]]["status"] = "available"
    state["queue"] = [item for item in state["queue"] if item["request_id"] != active_request_id]
    state["active_request_id"] = None
    state["state"] = "IDLE"
    save_state(state_path, state)
    emit(log_path, "media.playback.completed", request, created_at=created_at)
    return state


def mark_fault(
    state_path: Path,
    reason: str,
    operator_initials: str,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    state = load_state(state_path)
    state["state"] = "FAULT"
    state["fault"] = {
        "reason": reason,
        "operator_initials": operator_initials,
        "created_at": created_at or now(),
    }
    save_state(state_path, state)
    emit(log_path, "incident.opened", {"class": "MEDIA", **state["fault"]}, created_at=created_at)
    return state


def ensure_not_faulted(state: dict[str, Any]) -> None:
    if state["state"] == "FAULT":
        raise RuntimeError("Media Vault is in FAULT state")


def emit(
    log_path: Path | None,
    event_type: str,
    payload: dict[str, Any],
    created_at: str | None = None,
) -> None:
    if log_path is not None:
        append_event(log_path, event_type, "media-vault", payload, created_at=created_at)


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulate OMNIDAT Media Vault state.")
    parser.add_argument("--state", default="build/media-vault-state.json", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init")
    init_parser.add_argument("--catalog", default="data/media-catalog.sample.json", type=Path)

    request_parser = subparsers.add_parser("request")
    request_parser.add_argument("tape_id")
    request_parser.add_argument("--source", default="operator")
    request_parser.add_argument("--requested-by", default="ACCT-OPERATOR")

    approve_parser = subparsers.add_parser("approve-next")
    approve_parser.add_argument("--operator", default="OP")

    subparsers.add_parser("start")
    subparsers.add_parser("complete")

    fault_parser = subparsers.add_parser("fault")
    fault_parser.add_argument("reason")
    fault_parser.add_argument("--operator", default="OP")

    subparsers.add_parser("status")

    args = parser.parse_args()

    if args.command == "init":
        result = initialize_state(args.catalog, args.state)
    elif args.command == "request":
        result = create_request(args.state, args.tape_id, args.source, args.requested_by, args.log)
    elif args.command == "approve-next":
        result = approve_next_request(args.state, args.operator, args.log)
    elif args.command == "start":
        result = start_playback(args.state, args.log)
    elif args.command == "complete":
        result = complete_playback(args.state, args.log)
    elif args.command == "fault":
        result = mark_fault(args.state, args.reason, args.operator, args.log)
    else:
        result = load_state(args.state)

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
