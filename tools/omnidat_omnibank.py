from __future__ import annotations

import argparse
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from tools.omnidat_events import append_event, read_events


DEFAULT_PROFILE = Path("data/omnibank-fake-profile.json")


def load_omnibank_profile(path: Path = DEFAULT_PROFILE) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


class OmniBankFake:
    rail = "OMNIBANK_FAKE_SHADYBANK_CONTRACT"

    def __init__(
        self,
        ledger_path: Path = Path("build/omnibank-ledger.jsonl"),
        profile_path: Path = DEFAULT_PROFILE,
        journal: Any | None = None,
    ) -> None:
        self.ledger_path = ledger_path
        self.profile = load_omnibank_profile(profile_path)
        self.journal = journal
        self._authorizations: dict[tuple[str, str], dict[str, Any]] = {}

    def _journal_posting(self, ledger_event: str, payload: dict[str, Any]) -> None:
        if self.journal is not None:
            self.journal.append(
                "omnibucks.ledger.posted",
                {"ledger_event": ledger_event, **payload},
            )

    def authorize(
        self,
        pan: str,
        amount: str,
        merchant_id: str,
        description: str,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        normalized_amount = money(amount)
        auth_code = auth_code_for(pan, normalized_amount, merchant_id)
        payload = {
            "rail": self.rail,
            "endpoint": self.profile["contract"]["authorize"]["path"],
            "merchant_id": merchant_id,
            "pan_last4": pan[-4:],
            "amount": str(normalized_amount),
            "description": description,
            "auth_code": auth_code,
            "status": "approved",
            "response_code": "00",
        }
        append_event(self.ledger_path, "omnibank.authorized", "omnibank-fake", payload, created_at=created_at)
        self._journal_posting("omnibank.authorized", payload)
        self._authorizations[(auth_code, merchant_id)] = payload
        return payload

    def capture(
        self,
        auth_code: str,
        amount: str,
        merchant_id: str,
        description: str,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        authorization = self.find_authorization(auth_code, merchant_id)
        normalized_amount = money(amount)
        if normalized_amount > money(authorization["amount"]):
            raise ValueError("capture amount exceeds authorized amount")
        payload = {
            "rail": self.rail,
            "endpoint": self.profile["contract"]["capture"]["path"],
            "merchant_id": merchant_id,
            "pan_last4": authorization["pan_last4"],
            "amount": str(normalized_amount),
            "description": description,
            "auth_code": auth_code,
            "status": "captured",
            "response_code": "00",
        }
        append_event(self.ledger_path, "omnibank.captured", "omnibank-fake", payload, created_at=created_at)
        self._journal_posting("omnibank.captured", payload)
        return payload

    def find_authorization(self, auth_code: str, merchant_id: str) -> dict[str, Any]:
        cached = self._authorizations.get((auth_code, merchant_id))
        if cached is not None:
            return cached
        for event in reversed(read_events(self.ledger_path)):
            payload = event.get("payload", {})
            if (
                event.get("type") == "omnibank.authorized"
                and payload.get("auth_code") == auth_code
                and payload.get("merchant_id") == merchant_id
            ):
                return payload
        raise ValueError(f"unknown authorization {auth_code}")


def settle_sale(
    bank: OmniBankFake,
    terminal_id: str,
    amount: str,
    tender: str,
    merchant_id: str,
    created_at: str | None = None,
) -> dict[str, Any]:
    description = f"OMNIDAT X.25 POS.SALE {terminal_id}"
    authorization = bank.authorize(
        pan=tender,
        amount=amount,
        merchant_id=merchant_id,
        description=description,
        created_at=created_at,
    )
    capture = bank.capture(
        auth_code=authorization["auth_code"],
        amount=amount,
        merchant_id=merchant_id,
        description=f"{description} capture",
        created_at=created_at,
    )
    return {
        "rail": bank.rail,
        "auth_code": authorization["auth_code"],
        "authorize_status": authorization["status"],
        "capture_status": capture["status"],
        "response_code": capture["response_code"],
        "transcript": "\n".join(
            [
                "OMNIBANK POST /api/authorize",
                f"MERCHANT {merchant_id}",
                f"AMOUNT {money(amount)}",
                f"PAN ****{authorization['pan_last4']}",
                f"AUTH {authorization['auth_code']} RC {authorization['response_code']}",
                "OMNIBANK POST /api/capture",
                f"CAPTURE {capture['auth_code']} RC {capture['response_code']}",
                "CAPTURED",
            ]
        ),
    }


def run_full_card_sale_e2e(
    runtime_dir: Path = Path("build/e2e-omnibank"),
    data_dir: Path = Path("data"),
    terminal_id: str = "VF-NITEMARKT-01",
    amount: str = "12.50",
    pan: str = "4242424242424242",
    created_at: str | None = None,
) -> dict[str, Any]:
    from tools.omnidat_verifone import (
        simulate_field_directory,
        simulate_food_order,
        simulate_passport_stamp,
        simulate_pos_sale,
        simulate_terminal_update,
    )

    runtime_dir.mkdir(parents=True, exist_ok=True)
    event_log = runtime_dir / "events.jsonl"
    terminal_checks_log = runtime_dir / "terminal-checks.jsonl"
    ledger_path = runtime_dir / "omnibank-ledger.jsonl"
    report_path = runtime_dir / "report.json"
    bank = OmniBankFake(ledger_path=ledger_path)
    sale = simulate_pos_sale(
        data_dir=data_dir,
        terminal_id=terminal_id,
        amount=amount,
        tender=pan,
        log_path=event_log,
        bank=bank,
        created_at=created_at,
    )
    terminal_checks = {
        "directory": simulate_field_directory(
            data_dir=data_dir,
            terminal_id="VF-FIELD-01",
            query="miliways",
            log_path=terminal_checks_log,
            created_at=created_at,
        ),
        "food": simulate_food_order(
            data_dir=data_dir,
            queue_dir=runtime_dir / "queue",
            terminal_id="VF-FOOD-01",
            passport_id="PASS-04271",
            item_id="tea",
            quantity=2,
            log_path=terminal_checks_log,
            created_at=created_at,
        ),
        "passport": simulate_passport_stamp(
            data_dir=data_dir,
            activity_dir=runtime_dir / "activity",
            terminal_id="VF-PASS-01",
            passport_id="PASS-04271",
            action="CALL TEST LOOP",
            log_path=terminal_checks_log,
            created_at=created_at,
        ),
        "update": simulate_terminal_update(
            data_dir=data_dir,
            terminal_id=terminal_id,
            package_name="OMNIDAT.DTZ",
            log_path=terminal_checks_log,
            created_at=created_at,
        ),
    }
    terminal_events = [event["type"] for event in read_events(event_log)]
    terminal_check_events = [event["type"] for event in read_events(terminal_checks_log)]
    ledger_events = [event["type"] for event in read_events(ledger_path)]
    expected_terminal_events = ["terminal.dialed", "session.started", "session.ended", "terminal.receipt"]
    expected_ledger_events = ["omnibank.authorized", "omnibank.captured"]
    checks = {
        "terminal_event_sequence": terminal_events == expected_terminal_events,
        "bank_ledger_sequence": ledger_events == expected_ledger_events,
        "sale_captured": sale["status"] == "captured",
        "response_code_approved": sale["bank"]["response_code"] == "00",
        "card_redacted": pan not in sale["transcript"],
        "directory_terminal_complete": terminal_checks["directory"]["status"] == "complete",
        "food_terminal_accepted": terminal_checks["food"]["status"] == "accepted",
        "passport_terminal_cleared": terminal_checks["passport"]["status"] == "cleared",
        "update_terminal_ready": terminal_checks["update"]["status"] == "ready",
    }
    status = "passed" if all(checks.values()) else "failed"
    report = {
        "scenario": "verifone-pos-card-sale-to-omnibank",
        "status": status,
        "checks": checks,
        "sale": {
            "terminal_id": sale["terminal_id"],
            "program": sale["program"],
            "dial_number": sale["dial_number"],
            "host_x121": sale["x121"],
            "packet_service": sale["packet_service"],
            "status": sale["status"],
            "auth_code": sale["auth_code"],
            "session_id": sale["session_id"],
        },
        "bank": {
            "rail": sale["bank"]["rail"],
            "authorize_status": sale["bank"]["authorize_status"],
            "capture_status": sale["bank"]["capture_status"],
            "response_code": sale["bank"]["response_code"],
        },
        "terminal_checks": {
            name: {
                "terminal_id": check["terminal_id"],
                "program": check["program"],
                "dial_number": check["dial_number"],
                "host_x121": check["x121"],
                "packet_service": check["packet_service"],
                "status": check["status"],
            }
            for name, check in terminal_checks.items()
        },
        "event_log": {
            "path": str(event_log),
            "events": terminal_events,
        },
        "terminal_check_log": {
            "path": str(terminal_checks_log),
            "events": terminal_check_events,
        },
        "ledger": {
            "path": str(ledger_path),
            "events": ledger_events,
        },
        "transcript": sale["transcript"],
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    if status != "passed":
        raise RuntimeError(f"full card sale e2e failed: {json.dumps(checks, sort_keys=True)}")
    return report


def money(value: str | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def auth_code_for(pan: str, amount: Decimal, merchant_id: str) -> str:
    digits = "".join(character for character in f"{pan[-4:]}{amount}{merchant_id}" if character.isalnum())
    return digits[-6:].upper().rjust(6, "0")


def main() -> int:
    parser = argparse.ArgumentParser(description="OMNIDAT fake OmniBank ShadyBank-compatible rail.")
    parser.add_argument("--ledger", default="build/omnibank-ledger.jsonl", type=Path)
    parser.add_argument("--merchant", default="OMNI-NIGHTMARKT")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sale_parser = subparsers.add_parser("sale")
    sale_parser.add_argument("amount")
    sale_parser.add_argument("pan")

    e2e_parser = subparsers.add_parser("e2e-card-sale")
    e2e_parser.add_argument("--runtime-dir", default="build/e2e-omnibank", type=Path)
    e2e_parser.add_argument("--data-dir", default="data", type=Path)
    e2e_parser.add_argument("--terminal", default="VF-NITEMARKT-01")
    e2e_parser.add_argument("--amount", default="12.50")
    e2e_parser.add_argument("--pan", default="4242424242424242")

    args = parser.parse_args()
    bank = OmniBankFake(ledger_path=args.ledger)
    if args.command == "sale":
        result = settle_sale(
            bank,
            terminal_id="OMNIBANK-CLI",
            amount=args.amount,
            tender=args.pan,
            merchant_id=args.merchant,
        )
        print(result["transcript"])
    if args.command == "e2e-card-sale":
        report = run_full_card_sale_e2e(
            runtime_dir=args.runtime_dir,
            data_dir=args.data_dir,
            terminal_id=args.terminal,
            amount=args.amount,
            pan=args.pan,
        )
        print(report["transcript"])
        print(f"E2E STATUS: {report['status']}")
        print(f"REPORT: {args.runtime_dir / 'report.json'}")
        print(f"EVENT LOG: {report['event_log']['path']}")
        print(f"TERMINAL CHECK LOG: {report['terminal_check_log']['path']}")
        print(f"OMNIBANK LEDGER: {report['ledger']['path']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
