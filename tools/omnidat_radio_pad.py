from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from tools.omnidat_activity import log_activity
from tools.omnidat_events import append_event
from tools.omnidat_fryos_bridge import FryosTrpcBridge
from tools.omnidat_queue import create_order, get_order_status, list_menu


def parse_command(command: str) -> dict[str, Any]:
    parts = command.strip().split()
    if not parts:
        raise ValueError("empty command")
    return {"verb": parts[0].upper(), "args": parts[1:]}


def handle_command(
    command: str,
    data_dir: Path = Path("data"),
    queue_dir: Path = Path("build/queue"),
    activity_dir: Path = Path("build/activity"),
    log_path: Path | None = None,
    fryos_bridge: Any | None = None,
) -> str:
    parsed = parse_command(command)
    verb = parsed["verb"]
    args = parsed["args"]

    if verb == "HELP":
        return render_help()
    if verb == "DIR":
        namespace = args[0] if args else None
        return render_directory(data_dir, namespace=namespace)
    if verb == "CALL":
        require_args(args, 1, "CALL <ADDR>")
        return call_address(data_dir, args[0])
    if verb == "REQ":
        return handle_request(args, data_dir, queue_dir, log_path, fryos_bridge)
    if verb == "STAT":
        require_args(args, 2, "STAT <ADDR> <TICKET>")
        return render_ticket_status(queue_dir, args[1])
    if verb == "ACT":
        require_args(args, 3, "ACT <PASS> <ADDR> <ACTION>")
        record = log_activity(
            data_dir,
            activity_dir,
            passport_id=args[0],
            service_address=args[1],
            action=args[2],
            source="radio-pad",
            log_path=log_path,
        )
        return "\n".join([
            "OMNIDAT FIELD PAD",
            f"ACT {record['activity_id']}",
            f"PASS {record['identity_id']}",
            f"STATUS {record['status'].upper()}",
            "CLR 00",
        ])
    if verb == "MSG":
        require_args(args, 2, "MSG <ADDR> <TEXT>")
        payload = {"address": args[0], "message": " ".join(args[1:])}
        if log_path is not None:
            append_event(log_path, "radio.message.submitted", "radio-pad", payload)
        return "\n".join([
            "OMNIDAT FIELD PAD",
            f"MSG {args[0]} ACCEPTED",
            "CLR 00",
        ])
    if verb == "CLR":
        return "OMNIDAT FIELD PAD\nCLR 00"
    raise ValueError(f"unknown Radio PAD command {verb}")


def render_help() -> str:
    return "\n".join(
        [
            "OMNIDAT FIELD PAD",
            "DIR [NS]",
            "CALL <ADDR>",
            "REQ <ADDR> <VERB> [ARGS]",
            "STAT <ADDR> <TICKET>",
            "ACT <PASS> <ADDR> <ACTION>",
            "MSG <ADDR> <TEXT>",
            "CLR",
        ]
    )


def render_directory(data_dir: Path, namespace: str | None = None) -> str:
    entries = []
    for service in load_json(data_dir / "packet-services.json"):
        entries.append((service["address"], service["name"]))
    for app in load_json(data_dir / "campsite-apps.sample.json"):
        if app.get("status") == "active":
            entries.append((app["address"], app["app_name"].upper()))
    entries = sorted(entries)
    if namespace:
        entries = [entry for entry in entries if entry[0].startswith(namespace)]

    lines = ["OMNIDAT FIELD PAD", "DIR"]
    lines.extend(f"{address} {name}" for address, name in entries)
    lines.append("CLR 00")
    return "\n".join(lines)


def call_address(data_dir: Path, address: str) -> str:
    app = find_app(data_dir, address)
    if app is not None:
        return "\n".join([
            "OMNIDAT FIELD PAD",
            f"CALL {address}",
            app["app_name"].upper(),
            f"CLASS {app['access_class']}",
            "CLR 00",
        ])

    for service in load_json(data_dir / "packet-services.json"):
        if service["address"] == address:
            return "\n".join([
                "OMNIDAT FIELD PAD",
                f"CALL {address}",
                service["name"],
                f"CLASS {service['access_class']}",
                "CLR 00",
            ])
    raise ValueError(f"unknown packet address {address}")


def handle_request(
    args: list[str],
    data_dir: Path,
    queue_dir: Path,
    log_path: Path | None,
    fryos_bridge: Any | None = None,
) -> str:
    require_args(args, 2, "REQ <ADDR> <VERB> [ARGS]")
    address = args[0]
    request_verb = args[1].upper()

    if address == "020500" and request_verb == "MENU":
        return radio_trim(list_menu(data_dir, "miliways"))
    if address == "020501" and request_verb == "ORDER":
        require_args(args, 4, "REQ 020501 ORDER <ITEM> <PASS>")
        order = create_order(
            data_dir,
            queue_dir,
            queue_id="miliways",
            passport_id=args[3],
            item_id=args[2],
            quantity=1,
            log_path=log_path,
            fryos_bridge=fryos_bridge,
        )
        return render_order_summary(order)
    raise ValueError(f"unsupported request {address} {request_verb}")


def render_ticket_status(queue_dir: Path, ticket_id: str) -> str:
    return render_order_summary(get_order_status(queue_dir, ticket_id))


def render_order_summary(order: dict[str, Any]) -> str:
    position = order.get("queue_position")
    position_text = "READY" if position is None else str(position)
    return "\n".join([
        "OMNIDAT FIELD PAD",
        f"TKT {order['ticket_id']}",
        f"STATUS {order['status'].upper()}",
        f"POS {position_text}",
        "CLR 00",
    ])


def radio_trim(text: str) -> str:
    lines = ["OMNIDAT FIELD PAD"]
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("-") and stripped != "OMNIDAT QUEUE SERVICE":
            lines.append(stripped)
    lines.append("CLR 00")
    return "\n".join(lines)


def find_app(data_dir: Path, address: str) -> dict[str, Any] | None:
    for app in load_json(data_dir / "campsite-apps.sample.json"):
        if app["address"] == address:
            return app
    return None


def load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


def require_args(args: list[str], count: int, usage: str) -> None:
    if len(args) < count:
        raise ValueError(f"usage: {usage}")


def main() -> int:
    parser = argparse.ArgumentParser(description="OMNIDAT Radio PAD gateway.")
    parser.add_argument("command", nargs="+")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--queue-dir", default="build/queue", type=Path)
    parser.add_argument("--activity-dir", default="build/activity", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    parser.add_argument("--fryos-url", default=os.environ.get("FRYOS_BASE_URL"))
    parser.add_argument("--fryos-token", default=os.environ.get("FRYOS_OPERATOR_TOKEN"))
    args = parser.parse_args()
    fryos_bridge = (
        FryosTrpcBridge(args.fryos_url, args.fryos_token)
        if args.fryos_url and args.fryos_token
        else None
    )
    print(
        handle_command(
            " ".join(args.command),
            data_dir=args.data_dir,
            queue_dir=args.queue_dir,
            activity_dir=args.activity_dir,
            log_path=args.log,
            fryos_bridge=fryos_bridge,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
