import tempfile
import unittest
from pathlib import Path

from tools.omnidat_events import read_events
from tools.omnidat_verifone import (
    load_profile,
    simulate_field_directory,
    simulate_food_order,
    simulate_passport_stamp,
    simulate_pos_sale,
    simulate_terminal_update,
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

    def test_food_order_dials_8813_and_creates_miliways_ticket(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "events.jsonl"
            queue_dir = Path(temp_dir) / "queue"

            result = simulate_food_order(
                data_dir=Path("data"),
                queue_dir=queue_dir,
                terminal_id="VF-FOOD-01",
                passport_id="PASS-04271",
                item_id="tea",
                quantity=2,
                log_path=log_path,
                created_at="2028-07-01T12:10:00-07:00",
            )

            self.assertEqual(result["dial_number"], "8813")
            self.assertEqual(result["x121"], "311088020501")
            self.assertEqual(result["ticket_id"], "MLY-000001")
            self.assertIn("OMNIFOOD.TCL", result["transcript"])
            self.assertIn("ORDER.CREATE|311088020501|PASS-04271|tea|2", result["transcript"])
            self.assertIn("TICKET MLY-000001", result["transcript"])
            self.assertEqual(
                [event["type"] for event in read_events(log_path)],
                ["terminal.dialed", "session.started", "session.ended", "queue.order.accepted", "terminal.receipt"],
            )

    def test_passport_stamp_dials_8814_and_logs_activity(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "events.jsonl"
            activity_dir = Path(temp_dir) / "activity"

            result = simulate_passport_stamp(
                data_dir=Path("data"),
                activity_dir=activity_dir,
                terminal_id="VF-PASS-01",
                passport_id="PASS-04271",
                action="CALL TEST LOOP",
                log_path=log_path,
                created_at="2028-07-01T12:15:00-07:00",
            )

            self.assertEqual(result["dial_number"], "8814")
            self.assertEqual(result["x121"], "311088030021")
            self.assertEqual(result["activity_id"], "ACT-000001")
            self.assertIn("OMNIPASS.TCL", result["transcript"])
            self.assertIn("STAMP|311088030021|PASS-04271|CALL TEST LOOP", result["transcript"])
            self.assertIn("STAMP ACT-000001", result["transcript"])
            self.assertEqual(
                [event["type"] for event in read_events(log_path)],
                ["terminal.dialed", "session.started", "session.ended", "activity.logged", "terminal.receipt"],
            )

    def test_update_dials_8811_and_checks_terminal_management(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result = simulate_terminal_update(
                data_dir=Path("data"),
                terminal_id="VF-NITEMARKT-01",
                package_name="OMNIDAT.DTZ",
                log_path=Path(temp_dir) / "events.jsonl",
                created_at="2028-07-01T12:20:00-07:00",
            )

            self.assertEqual(result["dial_number"], "8811")
            self.assertEqual(result["x121"], "311088002020")
            self.assertEqual(result["packet_service"], "000014")
            self.assertIn("OMNIUPDATE.TCL", result["transcript"])
            self.assertIn("APP.UPDATE|311088002020|OMNIDAT.DTZ", result["transcript"])
            self.assertIn("DOWNLOAD READY", result["transcript"])

    def test_profile_documents_usb_modem_and_raspberry_pi_lab_target(self):
        profile = load_profile(Path("data") / "verifone-simulator-profile.json")

        self.assertEqual(profile["default_baud"], 2400)
        self.assertEqual(profile["lab_host"], "raspberry-pi-asterisk")
        self.assertIn("usb-modem-bank", profile["required_hardware"])
        self.assertEqual(profile["programs"]["sale"]["dial_number"], "8810")
        self.assertEqual(profile["programs"]["update"]["dial_number"], "8811")
        self.assertEqual(profile["programs"]["directory"]["dial_number"], "8812")
        self.assertEqual(profile["programs"]["food"]["packet_service"], "020501")
        self.assertEqual(profile["programs"]["passport"]["packet_service"], "030021")


if __name__ == "__main__":
    unittest.main()
