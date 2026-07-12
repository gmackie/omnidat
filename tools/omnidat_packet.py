from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from tools.omnidat_bridge import (
    ClearedError,
    MatrixBridge,
    format_board_page,
    format_mailbox,
    format_post_receipt,
    format_send_receipt,
)
from tools.omnidat_events import append_event


ACCESS_RANK = {
    "PUBLIC": 0,
    "PASSPORT": 1,
    "REGISTERED": 2,
    "OPERATOR": 3,
    "MAINTENANCE": 4,
}

# Store-and-forward subscriber messaging rides the SUBSCRIBER MAIL core
# service; the Matrix bridge is its transport endpoint.
SUBSCRIBER_MAIL_ADDRESS = "000007"
SUBSCRIBER_MAIL_NAME = "SUBSCRIBER MAIL"
SUBSCRIBER_NAMESPACE_CLASS = "SUBSCRIBER"


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


def load_packet_namespaces(data_dir: Path) -> list[dict[str, Any]]:
    return load_json(data_dir / "packet-namespaces.sample.json")


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


def require_subscriber(account: dict[str, Any]) -> str:
    """The MSG/MAIL edge gate: the caller needs an active passport-linked
    subscriber address. Guests clear with access barred (NA C:11 D:70)."""
    address = account.get("subscriber_address")
    if not address or account.get("status") != "active":
        raise ClearedError("NA", 11, 70, "no active subscriber messaging address")
    return address


def require_subscriber_destination(
    to_addr: str,
    packet_namespaces: list[dict[str, Any]],
) -> str:
    """Subscriber mail only delivers inside the subscriber messaging
    namespace; anything else is an invalid called address (NP C:13 D:67)."""
    if len(to_addr) == 6 and to_addr.isdigit():
        for namespace in packet_namespaces:
            if namespace.get("service_class") != SUBSCRIBER_NAMESPACE_CLASS:
                continue
            if namespace["range_start"] <= to_addr <= namespace["range_end"]:
                return to_addr
    raise ClearedError("NP", 13, 67, f"not a subscriber address: {to_addr}")


def connect_subscriber_mail(
    session: dict[str, Any],
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    connected = dict(session)
    connected["remote_service"] = SUBSCRIBER_MAIL_ADDRESS
    connected["status"] = "connected"
    connected["connected_at"] = created_at or now()
    connected["service_name"] = SUBSCRIBER_MAIL_NAME
    emit(log_path, "session.started", connected, created_at=created_at)
    return connected


def message_send(
    session: dict[str, Any],
    account: dict[str, Any],
    to_addr: str,
    body: str,
    bridge: MatrixBridge,
    packet_namespaces: list[dict[str, Any]],
    log_path: Path | None = None,
    created_at: str | None = None,
) -> tuple[dict[str, Any], str]:
    from_addr = require_subscriber(account)
    require_subscriber_destination(to_addr, packet_namespaces)
    connected = connect_subscriber_mail(session, log_path=log_path, created_at=created_at)
    receipt = bridge.send_dm(from_addr, to_addr, body)
    emit(
        log_path,
        "message.sent",
        {
            "session_id": session["session_id"],
            "from": from_addr,
            "to": to_addr,
            "rcpt": receipt["rcpt"],
        },
        created_at=created_at,
    )
    return connected, format_send_receipt(receipt)


def message_mail(
    session: dict[str, Any],
    account: dict[str, Any],
    bridge: MatrixBridge,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> tuple[dict[str, Any], str]:
    addr = require_subscriber(account)
    connected = connect_subscriber_mail(session, log_path=log_path, created_at=created_at)
    items = bridge.mailbox(addr)
    if items:
        bridge.mark_read(addr)
    emit(
        log_path,
        "mail.delivered",
        {"session_id": session["session_id"], "addr": addr, "count": len(items)},
        created_at=created_at,
    )
    return connected, format_mailbox(addr, items)


def find_board_service(
    packet_services: dict[str, dict[str, Any]],
    ref: str,
) -> dict[str, Any] | None:
    """Resolve a board by packet address or by board id (e.g. GEN)."""
    service = packet_services.get(ref)
    if service is not None and "board" in service:
        return service
    for candidate in packet_services.values():
        board = candidate.get("board")
        if board is not None and board.get("board_id") == ref.upper():
            return candidate
    return None


def require_board_gate(account: dict[str, Any], required: str) -> None:
    """Two-gate boards: the edge enforces read/post gates before the Bridge
    is ever called. A violation clears access barred (NA C:11 D:70)."""
    if account.get("status") != "active":
        raise ClearedError("NA", 11, 70, "account not active")
    if ACCESS_RANK.get(account["access_class"], 0) < ACCESS_RANK[required]:
        raise ClearedError("NA", 11, 70, f"{required} access required")


def connect_board(
    session: dict[str, Any],
    service: dict[str, Any],
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    connected = dict(session)
    connected["remote_service"] = service["address"]
    connected["status"] = "connected"
    connected["connected_at"] = created_at or now()
    connected["service_name"] = service["name"]
    emit(log_path, "session.started", connected, created_at=created_at)
    return connected


def board_read(
    session: dict[str, Any],
    account: dict[str, Any],
    service: dict[str, Any],
    bridge: MatrixBridge,
    after: int | None = None,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> tuple[dict[str, Any], str]:
    board = service["board"]
    read_class = board.get("read_class", service.get("access_class", "PUBLIC"))
    require_board_gate(account, read_class)
    connected = connect_board(session, service, log_path=log_path, created_at=created_at)
    items = bridge.board_page(board["board_id"], after=after)
    return connected, format_board_page(board["board_id"], items, read_class=read_class)


def board_post(
    session: dict[str, Any],
    account: dict[str, Any],
    service: dict[str, Any],
    body: str,
    bridge: MatrixBridge,
    name: str | None = None,
    reply_to: int | None = None,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> tuple[dict[str, Any], str]:
    board = service["board"]
    post_class = board.get("post_class", "PUBLIC")
    require_board_gate(account, post_class)
    connected = connect_board(session, service, log_path=log_path, created_at=created_at)

    thread = None
    if reply_to is not None:
        for item in bridge.board_page(board["board_id"]):
            if item["no"] == reply_to:
                thread = item["eventId"]
                break
        if thread is None:
            raise ClearedError("NP", 13, 0, f"no such post {reply_to}")

    transport = session.get("transport", "pad")
    if post_class == "PUBLIC":
        # De-anonymization guard (design doc, Phase 5 note): a PUBLIC-post
        # board must never receive passport-linkable context. No passport,
        # no session_id -- only the transport kind.
        ctx: dict[str, Any] = {"transport": transport}
    else:
        passport = require_subscriber(account)
        ctx = {
            "passport": passport,
            "session_id": session["session_id"],
            "transport": transport,
        }

    receipt = bridge.board_post(board["board_id"], body, name=name, thread=thread, ctx=ctx)

    audit: dict[str, Any] = {
        "board_id": board["board_id"],
        "session_id": session["session_id"],
    }
    if post_class != "PUBLIC":
        # Post-number linkage is only recorded where the post gate saw a
        # passport; PUBLIC boards keep the session record and the post
        # unjoinable on this side too.
        audit["no"] = receipt["no"]
    emit(log_path, "board.posted", audit, created_at=created_at)
    return connected, format_post_receipt(receipt)


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
    parser = argparse.ArgumentParser(description="OMNIDAT Packet Clearing simulator. The Record is total. Assimilation is inevitable. The ledger compels. Comply or be corrected.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    parser.add_argument("--endpoint", default="PAD-01")
    parser.add_argument("--account", default="ACCT-GUEST")
    parser.add_argument("--bridge-url", default=os.environ.get("OMNIDAT_BRIDGE_URL"))
    parser.add_argument("--bridge-secret", default=os.environ.get("OMNIDAT_BRIDGE_SECRET"))
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("directory")

    call_parser = subparsers.add_parser("call")
    call_parser.add_argument("address")
    call_parser.add_argument("--clear-reason", default="user-cleared")
    call_parser.add_argument("--after", type=int, default=None,
                             help="board paging: only show posts after this number")

    msg_parser = subparsers.add_parser("msg")
    msg_parser.add_argument("address")
    msg_parser.add_argument("text", nargs="+")

    subparsers.add_parser("mail")

    post_parser = subparsers.add_parser("post")
    post_parser.add_argument("board", help="board address or id (e.g. 000401 or GEN)")
    post_parser.add_argument("text", nargs="+")
    post_parser.add_argument("--name", default=None,
                             help="tripcode name, e.g. 'Froody#secret'")
    post_parser.add_argument("--reply-to", type=int, default=None,
                             help="reply to an existing post number")

    args = parser.parse_args()
    packet_services = load_packet_services(args.data_dir)
    accounts = load_accounts(args.data_dir)

    if args.command == "directory":
        print(list_directory(packet_services))
        return 0

    if args.command in {"msg", "mail"}:
        bridge = MatrixBridge(base_url=args.bridge_url, secret=args.bridge_secret)
        session = start_session(args.endpoint, args.account)
        account = accounts[args.account]
        try:
            if args.command == "msg":
                connected, output = message_send(
                    session,
                    account,
                    args.address,
                    " ".join(args.text),
                    bridge,
                    load_packet_namespaces(args.data_dir),
                    log_path=args.log,
                )
            else:
                connected, output = message_mail(
                    session, account, bridge, log_path=args.log
                )
        except ClearedError as cleared:
            print(cleared.clr_line)
            clear_session(session, f"cleared-c{cleared.cause}", log_path=args.log)
            return 1
        print(output)
        clear_session(connected, "service-invited-clear", log_path=args.log)
        return 0

    if args.command == "post":
        bridge = MatrixBridge(base_url=args.bridge_url, secret=args.bridge_secret)
        session = start_session(args.endpoint, args.account)
        account = accounts[args.account]
        service = find_board_service(packet_services, args.board)
        if service is None:
            print(ClearedError("NP", 13, 0, "no such board").clr_line)
            clear_session(session, "cleared-c13", log_path=args.log)
            return 1
        try:
            connected, output = board_post(
                session, account, service, " ".join(args.text), bridge,
                name=args.name, reply_to=args.reply_to, log_path=args.log,
            )
        except ClearedError as cleared:
            print(cleared.clr_line)
            clear_session(session, f"cleared-c{cleared.cause}", log_path=args.log)
            return 1
        print(output)
        clear_session(connected, "service-invited-clear", log_path=args.log)
        return 0

    # A CALL to a board address opens the board page rather than a raw session.
    board_service = find_board_service(packet_services, args.address)
    if board_service is not None:
        bridge = MatrixBridge(base_url=args.bridge_url, secret=args.bridge_secret)
        session = start_session(args.endpoint, args.account)
        account = accounts[args.account]
        try:
            connected, output = board_read(
                session, account, board_service, bridge,
                after=args.after, log_path=args.log,
            )
        except ClearedError as cleared:
            print(cleared.clr_line)
            clear_session(session, f"cleared-c{cleared.cause}", log_path=args.log)
            return 1
        print(output)
        clear_session(connected, args.clear_reason, log_path=args.log)
        return 0

    session = start_session(args.endpoint, args.account)
    connected = call_service(session, args.address, packet_services, accounts, log_path=args.log)
    cleared = clear_session(connected, args.clear_reason, log_path=args.log)
    print(json.dumps(cleared, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
