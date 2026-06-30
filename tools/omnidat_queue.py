from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from tools.omnidat_activity import load_passports
from tools.omnidat_events import append_event
from tools.omnidat_fryos_bridge import FryosTrpcBridge


WAITING_STATUSES = {"accepted", "preparing"}


class FryosBridge(Protocol):
    def create_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        pass

    def get_order(self, order_id: str) -> dict[str, Any] | None:
        pass


def load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


def load_queues(data_dir: Path) -> dict[str, dict[str, Any]]:
    return {
        queue["queue_id"]: queue
        for queue in load_json(data_dir / "queue-apps.sample.json")
    }


def list_menu(data_dir: Path, queue_id: str) -> str:
    queue = get_queue(load_queues(data_dir), queue_id)
    lines = [
        f"{queue['name'].upper()} MENU STATUS",
        "OMNIDAT QUEUE SERVICE",
        "",
        "ITEM       STATUS",
        "---------  ----------",
    ]
    for item in queue.get("items", []):
        lines.append(f"{item['name'].upper()}  {item['status'].replace('_', ' ').upper()}")
    lines.append("")
    return "\n".join(lines)


def create_order(
    data_dir: Path,
    queue_dir: Path,
    queue_id: str,
    passport_id: str,
    item_id: str,
    quantity: int,
    log_path: Path | None = None,
    created_at: str | None = None,
    fryos_bridge: FryosBridge | None = None,
    payment_method: str = "shadybucks",
) -> dict[str, Any]:
    queue = get_queue(load_queues(data_dir), queue_id)
    passports = load_passports(data_dir)
    if passport_id not in passports:
        raise ValueError(f"unknown passport {passport_id}")
    item = get_item(queue, item_id)
    if item["status"] != "available":
        raise ValueError(f"{item['name']} is {item['status']}")
    if quantity < 1:
        raise ValueError("quantity must be at least 1")

    fryos_order = None
    fryos_menu_item_id = item.get("fryos_menu_item_id")
    if fryos_bridge is not None and fryos_menu_item_id:
        fryos_order = fryos_bridge.create_order(
            {
                "source": "pos",
                "paymentMethod": payment_method,
                "items": [
                    {
                        "menuItemId": fryos_menu_item_id,
                        "quantity": quantity,
                        "modifiers": [
                            f"omnidat:{queue['service_address']}",
                            f"passport:{passport_id}",
                        ],
                    }
                ],
            }
        )

    queue_dir.mkdir(parents=True, exist_ok=True)
    created_at = created_at or now()
    order = {
        "ticket_id": next_ticket_id(queue_dir, queue["ticket_prefix"]),
        "queue_id": queue_id,
        "service_address": queue["service_address"],
        "passport_id": passport_id,
        "handle": passports[passport_id]["handle"],
        "item_id": item_id,
        "item_name": item["name"],
        "quantity": quantity,
        "status": "accepted",
        "created_at": created_at,
    }
    if fryos_order is not None:
        order.update(
            {
                "fryos_order_id": fryos_order["id"],
                "fryos_order_number": fryos_order["orderNumber"],
                "fryos_payment_status": fryos_order.get("paymentStatus"),
            }
        )
    orders = read_orders(queue_dir)
    orders.append(order)
    orders = with_positions(orders)
    write_orders(queue_dir, orders)
    order = get_order_status(queue_dir, order["ticket_id"], fryos_bridge=fryos_bridge)
    if log_path is not None:
        append_event(log_path, "queue.order.accepted", "queue-service", order, created_at=created_at)
    return order


def get_order_status(
    queue_dir: Path,
    ticket_id: str,
    fryos_bridge: FryosBridge | None = None,
) -> dict[str, Any]:
    if fryos_bridge is not None:
        refresh_fryos_statuses(queue_dir, fryos_bridge)
    orders = with_positions(read_orders(queue_dir))
    for order in orders:
        if order["ticket_id"] == ticket_id:
            return order
    raise ValueError(f"unknown ticket {ticket_id}")


def update_order_status(
    queue_dir: Path,
    ticket_id: str,
    status: str,
    updated_at: str | None = None,
    log_path: Path | None = None,
) -> dict[str, Any]:
    orders = read_orders(queue_dir)
    updated_at = updated_at or now()
    found = False
    for order in orders:
        if order["ticket_id"] == ticket_id:
            order["status"] = status
            order["updated_at"] = updated_at
            found = True
            break
    if not found:
        raise ValueError(f"unknown ticket {ticket_id}")
    write_orders(queue_dir, with_positions(orders))
    updated = get_order_status(queue_dir, ticket_id)
    if log_path is not None:
        append_event(log_path, "queue.order.updated", "queue-service", updated, created_at=updated_at)
    return updated


def read_orders(queue_dir: Path) -> list[dict[str, Any]]:
    path = queue_dir / "orders.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def write_orders(queue_dir: Path, orders: list[dict[str, Any]]) -> None:
    queue_dir.mkdir(parents=True, exist_ok=True)
    (queue_dir / "orders.json").write_text(json.dumps(orders, indent=2, sort_keys=True) + "\n")


def refresh_fryos_statuses(queue_dir: Path, fryos_bridge: FryosBridge) -> None:
    orders = read_orders(queue_dir)
    changed = False
    for order in orders:
        fryos_order_id = order.get("fryos_order_id")
        if not fryos_order_id:
            continue
        fryos_order = fryos_bridge.get_order(fryos_order_id)
        if fryos_order is None:
            continue
        status = fryos_order.get("status")
        payment_status = fryos_order.get("paymentStatus")
        if status and order.get("status") != status:
            order["status"] = status
            changed = True
        if payment_status and order.get("fryos_payment_status") != payment_status:
            order["fryos_payment_status"] = payment_status
            changed = True
    if changed:
        write_orders(queue_dir, with_positions(orders))


def with_positions(orders: list[dict[str, Any]]) -> list[dict[str, Any]]:
    position = 0
    positioned = []
    for order in orders:
        item = dict(order)
        if item["status"] in WAITING_STATUSES:
            position += 1
            item["queue_position"] = position
        else:
            item["queue_position"] = None
        positioned.append(item)
    return positioned


def render_order_receipt(order: dict[str, Any]) -> str:
    position = order.get("queue_position")
    position_text = "READY" if position is None else str(position)
    return "\n".join(
        [
            "MILIWAYS SERVICE BUREAU",
            "OMNIDAT QUEUE SERVICE",
            "",
            f"TICKET: {order['ticket_id']}",
            f"PASSPORT: {order['passport_id']} {order.get('handle', '')}".rstrip(),
            f"ITEM: {order['quantity']} X {order['item_name'].upper()}",
            f"STATUS: {order['status'].upper()}",
            f"QUEUE POSITION: {position_text}",
            f"CREATED: {order['created_at']}",
            "",
            "PRESENT RECEIPT AT PICKUP WINDOW",
            "",
        ]
    )


def get_queue(queues: dict[str, dict[str, Any]], queue_id: str) -> dict[str, Any]:
    if queue_id not in queues:
        raise ValueError(f"unknown queue {queue_id}")
    return queues[queue_id]


def get_item(queue: dict[str, Any], item_id: str) -> dict[str, Any]:
    for item in queue.get("items", []):
        if item["item_id"] == item_id:
            return item
    raise ValueError(f"unknown item {item_id}")


def next_ticket_id(queue_dir: Path, prefix: str) -> str:
    return f"{prefix}-{len(read_orders(queue_dir)) + 1:06d}"


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def main() -> int:
    parser = argparse.ArgumentParser(description="OMNIDAT queue service.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--queue-dir", default="build/queue", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    parser.add_argument("--fryos-url", default=os.environ.get("FRYOS_BASE_URL"))
    parser.add_argument("--fryos-token", default=os.environ.get("FRYOS_OPERATOR_TOKEN"))
    parser.add_argument("--payment-method", default="shadybucks")
    subparsers = parser.add_subparsers(dest="command", required=True)

    menu_parser = subparsers.add_parser("menu")
    menu_parser.add_argument("queue_id", default="miliways", nargs="?")

    order_parser = subparsers.add_parser("order")
    order_parser.add_argument("queue_id")
    order_parser.add_argument("passport_id")
    order_parser.add_argument("item_id")
    order_parser.add_argument("--quantity", type=int, default=1)

    status_parser = subparsers.add_parser("status")
    status_parser.add_argument("ticket_id")

    update_parser = subparsers.add_parser("update")
    update_parser.add_argument("ticket_id")
    update_parser.add_argument("status")

    args = parser.parse_args()
    fryos_bridge = (
        FryosTrpcBridge(args.fryos_url, args.fryos_token)
        if args.fryos_url and args.fryos_token
        else None
    )
    if args.command == "menu":
        print(list_menu(args.data_dir, args.queue_id))
    elif args.command == "order":
        order = create_order(
            args.data_dir,
            args.queue_dir,
            args.queue_id,
            args.passport_id,
            args.item_id,
            args.quantity,
            log_path=args.log,
            fryos_bridge=fryos_bridge,
            payment_method=args.payment_method,
        )
        print(render_order_receipt(order))
    elif args.command == "status":
        print(render_order_receipt(get_order_status(args.queue_dir, args.ticket_id, fryos_bridge=fryos_bridge)))
    else:
        print(render_order_receipt(update_order_status(args.queue_dir, args.ticket_id, args.status, log_path=args.log)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
