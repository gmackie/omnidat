import tempfile
import unittest
from pathlib import Path

from tools.omnidat_events import read_events
from tools.omnidat_verifone import (
    load_profile,
    simulate_field_directory,
    simulate_pos_sale,
)


class VerifoneSimulatorTests(unittest.TestCase):
    def test_pos_sale_dials_8810_and_emits_packet_and_terminal_events(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "events.jsonl"

            result = simulate_pos_sale(
                data_dir=Path("data"),
                terminal_id="VF-NITEMARKT-01",
                amount="12.50",
                tender="SBQR-TEST-0001",
                log_path=log_path,
                created_at="2028-07-01T12:00:00-07:00",
            )

            self.assertEqual(result["dial_number"], "8810")
            self.assertEqual(result["x121"], "311088002010")
            self.assertEqual(result["packet_service"], "000011")
            self.assertIn("VERIFONE OMNIDAT SIMULATOR", result["transcript"])
            self.assertIn("DIAL 8810", result["transcript"])
            self.assertIn("CONNECT 2400", result["transcript"])
            self.assertIn("POS.SALE|VF-NITEMARKT-01|12.50", result["transcript"])
            self.assertIn("APPROVED", result["transcript"])
            self.assertEqual(
                [event["type"] for event in read_events(log_path)],
                ["terminal.dialed", "session.started", "session.ended", "terminal.receipt"],
            )

    def test_field_directory_dials_8812_for_nightmarkt_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result = simulate_field_directory(
                data_dir=Path("data"),
                terminal_id="VF-FIELD-01",
                query="miliways",
                log_path=Path(temp_dir) / "events.jsonl",
                created_at="2028-07-01T12:05:00-07:00",
            )

            self.assertEqual(result["dial_number"], "8812")
            self.assertEqual(result["x121"], "311088010110")
            self.assertIn("OMNIDIR.TCL", result["transcript"])
            self.assertIn("DIR|311088010110|miliways", result["transcript"])

    def test_profile_documents_usb_modem_and_raspberry_pi_lab_target(self):
        profile = load_profile(Path("data") / "verifone-simulator-profile.json")

        self.assertEqual(profile["default_baud"], 2400)
        self.assertEqual(profile["lab_host"], "raspberry-pi-asterisk")
        self.assertIn("usb-modem-bank", profile["required_hardware"])
        self.assertEqual(profile["programs"]["sale"]["dial_number"], "8810")
        self.assertEqual(profile["programs"]["update"]["dial_number"], "8811")
        self.assertEqual(profile["programs"]["directory"]["dial_number"], "8812")


if __name__ == "__main__":
    unittest.main()
