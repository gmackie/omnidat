from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from tools.omnidat_activity import log_activity
from tools.omnidat_events import append_event
from tools.omnidat_packet import (
    call_service,
    clear_session,
    load_accounts,
    load_packet_services,
    start_session,
)
from tools.omnidat_queue import create_order


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


def simulate_food_order(
    data_dir: Path,
    queue_dir: Path,
    terminal_id: str,
    passport_id: str,
    item_id: str,
    quantity: int,
    log_path: Path | None = None,
    created_at: str | None = None,
    profile_path: Path = DEFAULT_PROFILE,
) -> dict[str, Any]:
    profile = load_profile(profile_path)
    program = profile["programs"]["food"]
    connected = connect_program(
        data_dir=data_dir,
        profile=profile,
        program=program,
        terminal_id=terminal_id,
        account_id="ACCT-GUEST",
        endpoint_id="PAD-FOOD-01",
        log_path=log_path,
        created_at=created_at,
        extra={"passport_id": passport_id, "item_id": item_id, "quantity": quantity},
    )
    order = create_order(
        data_dir=data_dir,
        queue_dir=queue_dir,
        queue_id="miliways",
        passport_id=passport_id,
        item_id=item_id,
        quantity=quantity,
        log_path=log_path,
        created_at=created_at,
    )
    transcript = render_food_transcript(profile, program, terminal_id, passport_id, item_id, quantity, order)
    result = {
        "terminal_id": terminal_id,
        "program": program["app"],
        "dial_number": program["dial_number"],
        "x121": program["x121"],
        "packet_service": program["packet_service"],
        "status": "accepted",
        "session_id": connected["session_id"],
        "ticket_id": order["ticket_id"],
        "transcript": transcript,
    }
    emit_terminal_event(
        log_path,
        "terminal.receipt",
        terminal_id,
        program,
        {"status": "accepted", "ticket_id": order["ticket_id"]},
        created_at=created_at,
    )
    return result


def simulate_passport_stamp(
    data_dir: Path,
    activity_dir: Path,
    terminal_id: str,
    passport_id: str,
    action: str,
    log_path: Path | None = None,
    created_at: str | None = None,
    profile_path: Path = DEFAULT_PROFILE,
) -> dict[str, Any]:
    profile = load_profile(profile_path)
    program = profile["programs"]["passport"]
    connected = connect_program(
        data_dir=data_dir,
        profile=profile,
        program=program,
        terminal_id=terminal_id,
        account_id="ACCT-GUEST",
        endpoint_id="PAD-PASSPORT-01",
        log_path=log_path,
        created_at=created_at,
        extra={"passport_id": passport_id, "action": action},
    )
    record = log_activity(
        data_dir=data_dir,
        activity_dir=activity_dir,
        passport_id=passport_id,
        service_address=program["packet_service"],
        action=action,
        source="verifone-simulator",
        log_path=log_path,
        created_at=created_at,
    )
    transcript = render_passport_transcript(profile, program, terminal_id, passport_id, action, record)
    result = {
        "terminal_id": terminal_id,
        "program": program["app"],
        "dial_number": program["dial_number"],
        "x121": program["x121"],
        "packet_service": program["packet_service"],
        "status": "cleared",
        "session_id": connected["session_id"],
        "activity_id": record["activity_id"],
        "transcript": transcript,
    }
    emit_terminal_event(
        log_path,
        "terminal.receipt",
        terminal_id,
        program,
        {"status": "cleared", "activity_id": record["activity_id"]},
        created_at=created_at,
    )
    return result


def simulate_terminal_update(
    data_dir: Path,
    terminal_id: str,
    package_name: str,
    log_path: Path | None = None,
    created_at: str | None = None,
    profile_path: Path = DEFAULT_PROFILE,
) -> dict[str, Any]:
    profile = load_profile(profile_path)
    program = profile["programs"]["update"]
    connected = connect_program(
        data_dir=data_dir,
        profile=profile,
        program=program,
        terminal_id=terminal_id,
        account_id="ACCT-OPERATOR",
        endpoint_id="PAD-UPDATE-01",
        log_path=log_path,
        created_at=created_at,
        extra={"package_name": package_name},
    )
    transcript = render_update_transcript(profile, program, terminal_id, package_name)
    return {
        "terminal_id": terminal_id,
        "program": program["app"],
        "dial_number": program["dial_number"],
        "x121": program["x121"],
        "packet_service": program["packet_service"],
        "status": "ready",
        "session_id": connected["session_id"],
        "transcript": transcript,
    }


def connect_program(
    data_dir: Path,
    profile: dict[str, Any],
    program: dict[str, Any],
    terminal_id: str,
    account_id: str,
    endpoint_id: str,
    log_path: Path | None,
    created_at: str | None,
    extra: dict[str, Any],
) -> dict[str, Any]:
    packet_services = load_packet_services(data_dir)
    accounts = load_accounts(data_dir)
    emit_terminal_event(
        log_path,
        "terminal.dialed",
        terminal_id,
        program,
        extra,
        created_at=created_at,
    )
    session = start_session(
        endpoint_id=endpoint_id,
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
    return clear_session(
        connected,
        clear_reason="terminal-complete",
        log_path=log_path,
        created_at=created_at,
    )


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


def render_food_transcript(
    profile: dict[str, Any],
    program: dict[str, Any],
    terminal_id: str,
    passport_id: str,
    item_id: str,
    quantity: int,
    order: dict[str, Any],
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
            f"ORDER.CREATE|{program['x121']}|{passport_id}|{item_id}|{quantity}",
            f"TICKET {order['ticket_id']}",
            f"QUEUE POSITION {order.get('queue_position')}",
            "RC 00",
            "ACCEPTED",
            "",
        ]
    )


def render_passport_transcript(
    profile: dict[str, Any],
    program: dict[str, Any],
    terminal_id: str,
    passport_id: str,
    action: str,
    record: dict[str, Any],
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
            f"STAMP|{program['x121']}|{passport_id}|{action}",
            f"STAMP {record['activity_id']}",
            "RC 00",
            "CLEARED",
            "",
        ]
    )


def render_update_transcript(
    profile: dict[str, Any],
    program: dict[str, Any],
    terminal_id: str,
    package_name: str,
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
            f"APP.UPDATE|{program['x121']}|{package_name}",
            "DOWNLOAD READY",
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

    food_parser = subparsers.add_parser("food")
    food_parser.add_argument("passport_id")
    food_parser.add_argument("item_id")
    food_parser.add_argument("--quantity", type=int, default=1)
    food_parser.add_argument("--queue-dir", default="build/queue", type=Path)

    passport_parser = subparsers.add_parser("passport")
    passport_parser.add_argument("passport_id")
    passport_parser.add_argument("action")
    passport_parser.add_argument("--activity-dir", default="build/activity", type=Path)

    update_parser = subparsers.add_parser("update")
    update_parser.add_argument("package_name", default="OMNIDAT.DTZ", nargs="?")

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
    elif args.command == "directory":
        result = simulate_field_directory(
            args.data_dir,
            args.terminal,
            args.query,
            log_path=args.log,
            profile_path=args.profile,
        )
    elif args.command == "food":
        result = simulate_food_order(
            args.data_dir,
            args.queue_dir,
            args.terminal,
            args.passport_id,
            args.item_id,
            args.quantity,
            log_path=args.log,
            profile_path=args.profile,
        )
    elif args.command == "passport":
        result = simulate_passport_stamp(
            args.data_dir,
            args.activity_dir,
            args.terminal,
            args.passport_id,
            args.action,
            log_path=args.log,
            profile_path=args.profile,
        )
    else:
        result = simulate_terminal_update(
            args.data_dir,
            args.terminal,
            args.package_name,
            log_path=args.log,
            profile_path=args.profile,
        )
    print(result["transcript"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
