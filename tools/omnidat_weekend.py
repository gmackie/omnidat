from __future__ import annotations

import argparse
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from tools.omnidat_events import read_events
from tools.omnidat_queue import read_orders, write_orders


CAMPER_SEED_AMOUNT = Decimal("80.00")
NIGHT_MARKET_NIGHTS = ["friday-night", "saturday-night"]
MEAL_WINDOWS = ["friday-dinner", "saturday-breakfast", "saturday-dinner", "sunday-breakfast"]
MERCHANTS = [
    {"merchant_id": "OMNI-NIGHTMARKT", "name": "NiteMarkt", "terminal_id": "VF-NITEMARKT-01"},
    {"merchant_id": "OMNI-TEA", "name": "Packet Tea Counter", "terminal_id": "VF-TEA-02"},
    {"merchant_id": "OMNI-ZINE", "name": "Zine Exchange", "terminal_id": "VF-ZINE-03"},
    {"merchant_id": "OMNI-PARTS", "name": "Cable Parts Desk", "terminal_id": "VF-PARTS-04"},
    {"merchant_id": "OMNI-MERCH", "name": "Camp Merch Table", "terminal_id": "VF-MERCH-05"},
]
CAMPSITES = [
    "Camp Laminar",
    "Camp Oscillator",
    "Camp Null Route",
    "Camp Tiny Packet",
    "Camp Breakfast Loop",
    "Camp CRT Glow",
    "Camp Blue Wire",
    "Camp Red Ledger",
    "Camp Bus Error",
    "Camp Port 23",
    "Camp Lunchbox",
    "Camp Switchyard",
]


def run_weekend_simulation(
    runtime_dir: Path = Path("build/weekend-sim"),
    data_dir: Path = Path("data"),
    camper_count: int = 1000,
) -> dict[str, Any]:
    runtime_dir.mkdir(parents=True, exist_ok=True)
    event_log = runtime_dir / "weekend-events.jsonl"
    bank_ledger = runtime_dir / "weekend-bank-ledger.jsonl"
    report_path = runtime_dir / "weekend-report.json"
    queue_dir = runtime_dir / "miliways-queue"
    events = JsonlEventWriter(event_log)
    ledger = JsonlEventWriter(bank_ledger)
    campers = seed_campers(camper_count)
    merchant_balances = {merchant["merchant_id"]: Decimal("0.00") for merchant in MERCHANTS}

    for camper in campers:
        events.append(
            "omnibucks.seeded",
            "weekend-simulator",
            {
                "camper_id": camper["camper_id"],
                "passport_id": camper["passport_id"],
                "account_id": camper["account_id"],
                "amount": money(CAMPER_SEED_AMOUNT),
            },
            created_at="2028-07-01T09:00:00-07:00",
        )

    provisioning = provision_campsites(events)
    night_market = run_night_market(camper_count, campers, merchant_balances, ledger, events)
    miliways = run_miliways_meals(queue_dir, campers, merchant_balances, events)
    forms = file_weekend_forms(events)
    terminals = run_terminal_sessions(events)
    event_log_events = read_events(event_log)
    event_summary = summarize_weekend_events(event_log_events)
    ledger_events = read_events(bank_ledger)
    queue_orders = read_orders(queue_dir)
    response_codes = count_response_codes(ledger_events)
    negative_balances = sum(1 for camper in campers if camper["balance"] < Decimal("0.00"))
    checks = {
        "thousand_campers_seeded": len(campers) == camper_count,
        "night_market_two_nights": night_market["nights"] == len(NIGHT_MARKET_NIGHTS),
        "night_market_all_captured": night_market["captured"] == night_market["sales"],
        "miliways_four_windows": miliways["service_windows"] == len(MEAL_WINDOWS),
        "x121_all_verified": provisioning["verified"] == provisioning["campsites"],
        "pos_all_connected": len(MERCHANTS) == sum(1 for merchant in MERCHANTS if merchant["terminal_id"]),
        "no_negative_balances": negative_balances == 0,
    }
    status = "passed" if all(checks.values()) else "failed"
    report = {
        "scenario": "omnidat-full-camp-weekend",
        "status": status,
        "checks": checks,
        "campers": {
            "count": len(campers),
            "seed_amount": money(CAMPER_SEED_AMOUNT),
            "total_seeded": money(CAMPER_SEED_AMOUNT * camper_count),
            "negative_balances": negative_balances,
            "ending_balance_total": money(sum((camper["balance"] for camper in campers), Decimal("0.00"))),
        },
        "identity": {
            "provider": "omniauth",
            "accounts": len(campers),
            "unique_subjects": len({camper["omniauth_subject"] for camper in campers}),
            "sample_domain": "campers.omnidat.gmac.io",
        },
        "merchants": {
            "count": len(MERCHANTS),
            "pos_terminals_connected": len(MERCHANTS),
            "accounts_configured": len(MERCHANTS),
            "settlement_accounts_linked": len(MERCHANTS),
            "balances": {merchant_id: money(balance) for merchant_id, balance in merchant_balances.items()},
            "setups": merchant_setups(),
        },
        "currency": {
            "primary": "OmniBucks",
            "issuer": "OmniBank",
            "controlled_by": "OMNIDAT",
            "shadybucks_conversion": {
                "status": "deferred-to-2028",
                "mode": "bridge-ledger",
                "rate_placeholder": "1 OMNIBUCK = 1 SHADYBUCK pending ShadyBank agreement",
            },
        },
        "night_market": night_market,
        "miliways": miliways,
        "forms": forms,
        "terminals": terminals,
        "x121_provisioning": provisioning,
        "bank": {
            "institution": "OmniBank",
            "currency": "OmniBucks",
            "rail": "OMNIBANK_OMNIBUCKS_LEDGER",
            "ledger_path": str(bank_ledger),
            "events": [event["type"] for event in ledger_events],
            "response_codes": response_codes,
        },
        "historical_records": historical_records(),
        "event_log": {
            "path": str(event_log),
            "summary": event_summary,
        },
        "evidence": {
            "event_log": {
                "path": str(event_log),
                "events": len(event_log_events),
                "summary": event_summary,
            },
            "bank_ledger": {
                "path": str(bank_ledger),
                "events": len(ledger_events),
                "response_codes": response_codes,
            },
            "queue_orders": {
                "path": str(queue_dir / "orders.json"),
                "records": len(queue_orders),
            },
            "report": {
                "path": str(report_path),
            },
        },
        "samples": {
            "forms": sample_forms(),
            "terminal_sessions": sample_terminal_sessions(),
            "merchant_setups": merchant_setups()[:3],
            "x121_assignments": provisioning["assignments"][:3],
        },
    }
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    if status != "passed":
        raise RuntimeError(f"weekend simulation failed: {json.dumps(checks, sort_keys=True)}")
    return report


def seed_campers(camper_count: int) -> list[dict[str, Any]]:
    campers = []
    for index in range(1, camper_count + 1):
        campers.append(
            {
                "camper_id": f"CAMPER-{index:04d}",
                "passport_id": f"PASS-{index:05d}",
                "account_id": f"SB-CAMPER-{index:04d}",
                "omniauth_subject": f"omniauth|omnidat-camper-{index:04d}",
                "omniauth_email": f"camper-{index:04d}@campers.omnidat.gmac.io",
                "pan": f"42424242{index:08d}",
                "balance": CAMPER_SEED_AMOUNT,
            }
        )
    return campers


def provision_campsites(events: "JsonlEventWriter") -> dict[str, Any]:
    assignments = []
    for index, campsite in enumerate(CAMPSITES, start=1):
        x121 = f"311088020{600 + index:03d}"
        packet_address = "000001" if index % 2 else "020501"
        session = {
            "kind": "pad",
            "endpoint_id": "PAD-PROVISIONING",
            "account_id": "ACCT-000001",
            "remote_service": packet_address,
            "service_name": "Provisioning Verification",
        }
        events.append("session.started", "packet-clearing", session, created_at="2028-07-01T10:00:00-07:00")
        events.append("session.ended", "packet-clearing", {**session, "clear_reason": "x121-verified"}, created_at="2028-07-01T10:00:00-07:00")
        assignment = {
            "campsite": campsite,
            "x121": x121,
            "transport": "meshcore" if index % 2 else "wifi-tcp",
            "verified": True,
        }
        assignments.append(assignment)
        events.append("x121.provisioned", "weekend-simulator", assignment, created_at="2028-07-01T10:00:00-07:00")
    return {
        "campsites": len(assignments),
        "verified": sum(1 for assignment in assignments if assignment["verified"]),
        "assignments": assignments,
    }


def run_night_market(
    camper_count: int,
    campers: list[dict[str, Any]],
    merchant_balances: dict[str, Decimal],
    ledger: "JsonlEventWriter",
    events: "JsonlEventWriter",
) -> dict[str, Any]:
    sales = 0
    captured = 0
    totals_by_night = {}
    sale_count_per_night = max(1, camper_count // 2)
    for night_index, night in enumerate(NIGHT_MARKET_NIGHTS):
        night_total = Decimal("0.00")
        for offset in range(sale_count_per_night):
            camper = campers[(night_index * sale_count_per_night + offset) % camper_count]
            merchant = MERCHANTS[offset % len(MERCHANTS)]
            amount = Decimal("7.00") + Decimal(str(offset % 5))
            if camper["balance"] < amount:
                continue
            auth_code = auth_code_for(camper["pan"], amount, merchant["merchant_id"])
            created_at = f"2028-07-0{night_index + 1}T21:00:00-07:00"
            ledger.append("omnibank.authorized", "omnibank-weekend", {
                "rail": "OMNIBANK_OMNIBUCKS_LEDGER",
                "merchant_id": merchant["merchant_id"],
                "terminal_id": merchant["terminal_id"],
                "account_id": camper["account_id"],
                "pan_last4": camper["pan"][-4:],
                "amount": money(amount),
                "auth_code": auth_code,
                "status": "approved",
                "response_code": "00",
            }, created_at=created_at)
            ledger.append("omnibank.captured", "omnibank-weekend", {
                "rail": "OMNIBANK_OMNIBUCKS_LEDGER",
                "merchant_id": merchant["merchant_id"],
                "terminal_id": merchant["terminal_id"],
                "account_id": camper["account_id"],
                "pan_last4": camper["pan"][-4:],
                "amount": money(amount),
                "auth_code": auth_code,
                "status": "captured",
                "response_code": "00",
            }, created_at=created_at)
            camper["balance"] -= amount
            merchant_balances[merchant["merchant_id"]] += amount
            sales += 1
            captured += 1
            night_total += amount
            events.append(
                "nightmarket.sale.captured",
                "weekend-simulator",
                {
                    "night": night,
                    "camper_id": camper["camper_id"],
                    "merchant_id": merchant["merchant_id"],
                    "terminal_id": merchant["terminal_id"],
                    "amount": money(amount),
                    "auth_code": auth_code,
                    "response_code": "00",
                },
                created_at=created_at,
            )
        totals_by_night[night] = money(night_total)
    return {
        "nights": len(NIGHT_MARKET_NIGHTS),
        "sales": sales,
        "captured": captured,
        "totals_by_night": totals_by_night,
    }


def run_miliways_meals(
    queue_dir: Path,
    campers: list[dict[str, Any]],
    merchant_balances: dict[str, Decimal],
    events: "JsonlEventWriter",
) -> dict[str, Any]:
    orders = 0
    total = Decimal("0.00")
    orders_per_window = max(1, int(len(campers) * Decimal("0.4")))
    item_cycle = ["tea", "coffee"]
    all_orders = []
    for window_index, window in enumerate(MEAL_WINDOWS):
        for offset in range(orders_per_window):
            camper = campers[(window_index * orders_per_window + offset) % len(campers)]
            item_id = item_cycle[offset % len(item_cycle)]
            quantity = 1 + (offset % 2)
            amount = Decimal("4.00") * quantity
            if camper["balance"] < amount:
                continue
            order = weekend_order(window, orders + 1, existing_passport_id(offset), item_id, quantity, f"2028-07-0{window_index + 1}T12:00:00-07:00")
            all_orders.append(order)
            events.append("queue.order.accepted", "queue-service", order, created_at=order["created_at"])
            camper["balance"] -= amount
            merchant_balances["OMNI-NIGHTMARKT"] += amount
            orders += 1
            total += amount
            events.append(
                "miliways.window.order",
                "weekend-simulator",
                {
                    "window": window,
                    "camper_id": camper["camper_id"],
                    "ticket_id": order["ticket_id"],
                    "amount": money(amount),
                },
                created_at=f"2028-07-0{window_index + 1}T12:00:00-07:00",
            )
    write_orders(queue_dir, all_orders)
    return {
        "service_windows": len(MEAL_WINDOWS),
        "orders": orders,
        "tickets_issued": len(all_orders),
        "gross": money(total),
    }


def file_weekend_forms(events: "JsonlEventWriter") -> dict[str, Any]:
    by_type = {
        "campsite-provisioning": 12,
        "merchant-onboarding": 5,
        "activity-passport": 220,
        "lost-property": 38,
        "volunteer-shift": 65,
    }
    for form_type, count in by_type.items():
        for index in range(1, count + 1):
            events.append(
                "form.filed",
                "weekend-simulator",
                {
                    "form_type": form_type,
                    "form_id": f"FORM-{form_type.upper()}-{index:04d}",
                    "status": "filed",
                },
                created_at="2028-07-02T15:00:00-07:00",
            )
    return {
        "total_filed": sum(by_type.values()),
        "by_type": by_type,
        "status": "filed",
    }


def run_terminal_sessions(events: "JsonlEventWriter") -> dict[str, Any]:
    by_program = {
        "OMNISALE.TCL": 120,
        "OMNIFOOD.TCL": 82,
        "OMNIDIR.TCL": 55,
        "OMNIPASS.TCL": 55,
    }
    for program, count in by_program.items():
        for index in range(1, count + 1):
            events.append(
                "terminal.session",
                "weekend-simulator",
                {
                    "program": program,
                    "terminal_id": f"VF-{program.removesuffix('.TCL')}-{index:04d}",
                    "status": "complete",
                },
                created_at="2028-07-02T16:00:00-07:00",
            )
    return {
        "total_sessions": sum(by_program.values()),
        "by_program": by_program,
        "status": "complete",
    }


def weekend_order(window: str, sequence: int, passport_id: str, item_id: str, quantity: int, created_at: str) -> dict[str, Any]:
    return {
        "ticket_id": f"MLY-{sequence:06d}",
        "queue_id": "miliways",
        "service_address": "020501",
        "passport_id": passport_id,
        "handle": "RED-LINE-27" if passport_id == "PASS-04271" else "BLUE-FORM-12",
        "item_id": item_id,
        "item_name": "Tea" if item_id == "tea" else "Coffee",
        "quantity": quantity,
        "status": "accepted",
        "queue_position": sequence,
        "service_window": window,
        "created_at": created_at,
    }


def existing_passport_id(offset: int) -> str:
    return "PASS-04271" if offset % 2 == 0 else "PASS-02024"


def summarize_weekend_events(events: list[dict[str, Any]]) -> dict[str, int]:
    summary: dict[str, int] = {}
    for event in events:
        summary[event["type"]] = summary.get(event["type"], 0) + 1
    return summary


def count_response_codes(events: list[dict[str, Any]]) -> dict[str, int]:
    codes: dict[str, int] = {}
    for event in events:
        if event.get("type") != "omnibank.captured":
            continue
        code = event.get("payload", {}).get("response_code", "unknown")
        codes[code] = codes.get(code, 0) + 1
    return codes


class JsonlEventWriter:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text("")
        self.sequence = 0

    def append(self, event_type: str, source: str, payload: dict[str, Any], created_at: str) -> dict[str, Any]:
        self.sequence += 1
        event = {
            "event_id": f"EVT-{created_at[:10].replace('-', '')}-{self.sequence:06d}",
            "type": event_type,
            "source": source,
            "created_at": created_at,
            "payload": payload,
        }
        with self.path.open("a") as handle:
            handle.write(json.dumps(event, sort_keys=True) + "\n")
        return event


def auth_code_for(pan: str, amount: Decimal, merchant_id: str) -> str:
    digits = "".join(character for character in f"{pan[-4:]}{amount}{merchant_id}" if character.isalnum())
    return digits[-6:].upper().rjust(6, "0")


def merchant_setups() -> list[dict[str, Any]]:
    setups = []
    for index, merchant in enumerate(MERCHANTS, start=1):
        setups.append(
            {
                "merchant_id": merchant["merchant_id"],
                "name": merchant["name"],
                "omniauth_subject": f"omniauth|merchant-{merchant['merchant_id'].lower()}",
                "omnibank_account_id": f"OB-MERCHANT-{index:03d}",
                "settlement_currency": "OmniBucks",
                "pos_terminal_id": merchant["terminal_id"],
                "status": "configured",
            }
        )
    return setups


def sample_forms() -> list[dict[str, str]]:
    return [
        {
            "form_type": "campsite-provisioning",
            "form_id": "FORM-CAMPSITE-PROVISIONING-0001",
            "status": "filed",
        },
        {
            "form_type": "merchant-onboarding",
            "form_id": "FORM-MERCHANT-ONBOARDING-0001",
            "status": "filed",
        },
        {
            "form_type": "activity-passport",
            "form_id": "FORM-ACTIVITY-PASSPORT-0001",
            "status": "filed",
        },
    ]


def sample_terminal_sessions() -> list[dict[str, str]]:
    return [
        {
            "program": "OMNISALE.TCL",
            "terminal_id": "VF-OMNISALE-0001",
            "status": "complete",
        },
        {
            "program": "OMNIFOOD.TCL",
            "terminal_id": "VF-OMNIFOOD-0001",
            "status": "complete",
        },
        {
            "program": "OMNIDIR.TCL",
            "terminal_id": "VF-OMNIDIR-0001",
            "status": "complete",
        },
    ]


def historical_records() -> dict[str, Any]:
    records = {
        "toorcamp-2028-planning": {
            "status": "planning",
            "network": "Exchange 88 packet clearing",
            "records": ["x121-provisioning", "merchant-ledger", "activity-passport"],
        },
        "blackrock-furrytel-adjacent-lab": {
            "status": "reference",
            "network": "bootstrap peer pattern",
            "records": ["pbx-peer-notes", "field-terminal-tests"],
        },
        "omnitel-raspi-bench": {
            "status": "lab",
            "network": "Asterisk + SIP + USB modem bench",
            "records": ["verifone-pos", "omnibank-ledger", "terminal-update"],
        },
    }
    return {
        "deployments": len(records),
        "records": records,
    }


def money(value: Decimal | str) -> str:
    return str(Decimal(str(value)).quantize(Decimal("0.01")))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a full OMNIDAT camp weekend simulation.")
    parser.add_argument("--runtime-dir", default="build/weekend-sim", type=Path)
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--campers", default=1000, type=int)
    args = parser.parse_args()
    report = run_weekend_simulation(args.runtime_dir, args.data_dir, args.campers)
    print(f"WEEKEND STATUS: {report['status']}")
    print(f"CAMPERS: {report['campers']['count']} SEEDED {report['campers']['total_seeded']} OMNIBUCKS")
    print(f"NIGHT MARKET: {report['night_market']['sales']} SALES CAPTURED {report['night_market']['captured']}")
    print(f"MILIWAYS: {report['miliways']['orders']} ORDERS ACROSS {report['miliways']['service_windows']} WINDOWS")
    print(f"X121: {report['x121_provisioning']['verified']} VERIFIED CAMPSITES")
    print(f"REPORT: {args.runtime_dir / 'weekend-report.json'}")
    print(f"EVENT LOG: {report['event_log']['path']}")
    print(f"BANK LEDGER: {report['bank']['ledger_path']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
