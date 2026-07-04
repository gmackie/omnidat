import tempfile
import unittest
from pathlib import Path

from tools.omnidat_events import read_events
from tools.omnidat_omnibank import (
    OmniBankFake,
    load_omnibank_profile,
)
from tools.omnidat_verifone import simulate_pos_sale


class OmniBankEndToEndTests(unittest.TestCase):
    def test_omnibank_profile_tracks_shadybank_contract_without_tokens(self):
        profile = load_omnibank_profile(Path("data/omnibank-fake-profile.json"))

        self.assertEqual(profile["source_repo"], "/Volumes/dev/shady/shadybank")
        self.assertEqual(profile["contract"]["authorize"]["path"], "/api/authorize")
        self.assertEqual(profile["contract"]["capture"]["path"], "/api/capture")
        self.assertEqual(profile["merchant"]["display_name"], "OMNIDAT Nightmarkt Test Merchant")
        self.assertEqual(profile["merchant"]["token_storage"], "FEP_ONLY")
        self.assertNotIn("token", profile["merchant"])

    def test_fake_omnibank_authorizes_and_captures_purchase(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            ledger_path = Path(temp_dir) / "omnibank-ledger.jsonl"
            bank = OmniBankFake(ledger_path=ledger_path)

            auth = bank.authorize(
                pan="4242424242424242",
                amount="12.50",
                merchant_id="OMNI-NIGHTMARKT",
                description="OMNIDAT X.25 POS.SALE VF-NITEMARKT-01",
            )
            capture = bank.capture(
                auth_code=auth["auth_code"],
                amount="12.50",
                merchant_id="OMNI-NIGHTMARKT",
                description="capture",
            )

            self.assertEqual(auth["status"], "approved")
            self.assertEqual(auth["response_code"], "00")
            self.assertEqual(capture["status"], "captured")
            self.assertEqual(capture["auth_code"], auth["auth_code"])
            self.assertEqual([event["type"] for event in read_events(ledger_path)], ["omnibank.authorized", "omnibank.captured"])

    def test_verifone_sale_settles_through_fake_omnibank_end_to_end(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            event_log = Path(temp_dir) / "events.jsonl"
            ledger_path = Path(temp_dir) / "omnibank-ledger.jsonl"
            bank = OmniBankFake(ledger_path=ledger_path)

            result = simulate_pos_sale(
                data_dir=Path("data"),
                terminal_id="VF-NITEMARKT-01",
                amount="12.50",
                tender="4242424242424242",
                log_path=event_log,
                bank=bank,
                created_at="2028-07-01T12:00:00-07:00",
            )

            self.assertEqual(result["status"], "captured")
            self.assertEqual(result["bank"]["rail"], "OMNIBANK_FAKE_SHADYBANK_CONTRACT")
            self.assertEqual(result["bank"]["capture_status"], "captured")
            self.assertIn("OMNIBANK POST /api/authorize", result["transcript"])
            self.assertIn("OMNIBANK POST /api/capture", result["transcript"])
            self.assertIn("CAPTURED", result["transcript"])
            self.assertNotIn("4242424242424242", result["transcript"])
            self.assertEqual(
                [event["type"] for event in read_events(event_log)],
                ["terminal.dialed", "session.started", "session.ended", "terminal.receipt"],
            )
            self.assertEqual(read_events(event_log)[-1]["payload"]["status"], "captured")
            self.assertEqual([event["type"] for event in read_events(ledger_path)], ["omnibank.authorized", "omnibank.captured"])


if __name__ == "__main__":
    unittest.main()
