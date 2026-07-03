from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from tools.omnidat_events import append_event
from tools.omnidat_packet import (
    call_service,
    clear_session,
    load_accounts,
    load_packet_services,
    start_session,
)


DEFAULT_PROFILE = Path("data/verifone-simulator-profile.json")


def load_profile(path: Path = DEFAULT_PROFILE) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


def simulate_pos_sale(
    data_dir: Path,
    terminal_id: str,
    amount: str,
    tender: str,
    log_path: Path | None = None,
    created_at: str | None = None,
    profile_path: Path = DEFAULT_PROFILE,
) -> dict[str, Any]:
    profile = load_profile(profile_path)
    program = profile["programs"]["sale"]
    packet_services = load_packet_services(data_dir)
    accounts = load_accounts(data_dir)
    account_id = profile.get("default_pos_account", "ACCT-VENDOR-DEMO")

    emit_terminal_event(
        log_path,
        "terminal.dialed",
        terminal_id,
        program,
        {"amount": amount, "tender": redact_tender(tender)},
        created_at=created_at,
    )
    session = start_session(
        endpoint_id=profile.get("default_endpoint", "PAD-01"),
        account_id=account_id,
        created_at=created_at,
    )
    connected = call_service(
        session,
        program["packet_service"],
        packet_services,
        accounts,
        log_path=log_path,
        created_at=created_at,
    )
    cleared = clear_session(
        connected,
        clear_reason="terminal-complete",
        log_path=log_path,
        created_at=created_at,
    )
    auth_code = authorization_code(terminal_id, amount)
    transcript = render_sale_transcript(profile, program, terminal_id, amount, tender, auth_code)
    result = {
        "terminal_id": terminal_id,
        "program": program["app"],
        "dial_number": program["dial_number"],
        "x121": program["x121"],
        "packet_service": program["packet_service"],
        "status": "approved",
        "auth_code": auth_code,
        "session_id": cleared["session_id"],
        "transcript": transcript,
    }
    emit_terminal_event(
        log_path,
        "terminal.receipt",
        terminal_id,
        program,
        {"status": "approved", "auth_code": auth_code, "amount": amount},
        created_at=created_at,
    )
    return result


def simulate_field_directory(
    data_dir: Path,
    terminal_id: str,
    query: str,
    log_path: Path | None = None,
    created_at: str | None = None,
    profile_path: Path = DEFAULT_PROFILE,
) -> dict[str, Any]:
    profile = load_profile(profile_path)
    program = profile["programs"]["directory"]
    packet_services = load_packet_services(data_dir)
    accounts = load_accounts(data_dir)

    emit_terminal_event(
        log_path,
        "terminal.dialed",
        terminal_id,
        program,
        {"query": query},
        created_at=created_at,
    )
    session = start_session(
        endpoint_id="PAD-GUEST-01",
        account_id="ACCT-GUEST",
        created_at=created_at,
    )
    connected = call_service(
        session,
        program["packet_service"],
        packet_services,
        accounts,
        log_path=log_path,
        created_at=created_at,
    )
    cleared = clear_session(
        connected,
        clear_reason="terminal-complete",
        log_path=log_path,
        created_at=created_at,
    )
    transcript = render_directory_transcript(profile, program, terminal_id, query)
    return {
        "terminal_id": terminal_id,
        "program": program["app"],
        "dial_number": program["dial_number"],
        "x121": program["x121"],
        "packet_service": program["packet_service"],
        "status": "complete",
        "session_id": cleared["session_id"],
        "transcript": transcript,
    }


def render_sale_transcript(
    profile: dict[str, Any],
    program: dict[str, Any],
    terminal_id: str,
    amount: str,
    tender: str,
    auth_code: str,
) -> str:
    return "\n".join(
        [
            "VERIFONE OMNIDAT SIMULATOR",
            f"MODEL {profile['terminal_family']}",
            f"APP {program['app']}",
            f"TERM {terminal_id}",
            f"DIAL {program['dial_number']}",
            f"CONNECT {profile['default_baud']}",
            f"X121 {program['x121']}",
            f"POS.SALE|{terminal_id}|{amount}|{redact_tender(tender)}",
            f"AUTH {auth_code}",
            "RC 00",
            "APPROVED",
            "",
        ]
    )


def render_directory_transcript(
    profile: dict[str, Any],
    program: dict[str, Any],
    terminal_id: str,
    query: str,
) -> str:
    return "\n".join(
        [
            "VERIFONE OMNIDAT SIMULATOR",
            f"MODEL {profile['terminal_family']}",
            f"APP {program['app']}",
            f"TERM {terminal_id}",
            f"DIAL {program['dial_number']}",
            f"CONNECT {profile['default_baud']}",
            f"X121 {program['x121']}",
            f"DIR|{program['x121']}|{query}",
            "RC 00",
            "COMPLETE",
            "",
        ]
    )


def emit_terminal_event(
    log_path: Path | None,
    event_type: str,
    terminal_id: str,
    program: dict[str, Any],
    extra: dict[str, Any],
    created_at: str | None = None,
) -> None:
    if log_path is None:
        return
    payload = {
        "terminal_id": terminal_id,
        "program": program["app"],
        "dial_number": program["dial_number"],
        "x121": program["x121"],
        **extra,
    }
    append_event(log_path, event_type, "verifone-simulator", payload, created_at=created_at)


def authorization_code(terminal_id: str, amount: str) -> str:
    digits = "".join(character for character in f"{terminal_id}{amount}" if character.isdigit())
    return f"OMNI{digits[-4:].rjust(4, '0')}"


def redact_tender(tender: str) -> str:
    if len(tender) <= 8:
        return tender
    return f"{tender[:4]}...{tender[-4:]}"


def main() -> int:
    parser = argparse.ArgumentParser(description="OMNIDAT VeriFone terminal simulator.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--profile", default=DEFAULT_PROFILE, type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    parser.add_argument("--terminal", default="VF-NITEMARKT-01")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sale_parser = subparsers.add_parser("sale")
    sale_parser.add_argument("amount")
    sale_parser.add_argument("tender")

    directory_parser = subparsers.add_parser("directory")
    directory_parser.add_argument("query")

    args = parser.parse_args()
    if args.command == "sale":
        result = simulate_pos_sale(
            args.data_dir,
            args.terminal,
            args.amount,
            args.tender,
            log_path=args.log,
            profile_path=args.profile,
        )
    else:
        result = simulate_field_directory(
            args.data_dir,
            args.terminal,
            args.query,
            log_path=args.log,
            profile_path=args.profile,
        )
    print(result["transcript"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
