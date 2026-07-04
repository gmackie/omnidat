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
    ) -> None:
        self.ledger_path = ledger_path
        self.profile = load_omnibank_profile(profile_path)

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
        return payload

    def find_authorization(self, auth_code: str, merchant_id: str) -> dict[str, Any]:
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
