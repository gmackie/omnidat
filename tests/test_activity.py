import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_activity import (
    list_badges,
    load_passports,
    log_activity,
    render_activity_receipt,
    read_activity_records,
)
from tools.omnidat_events import read_events


class ActivityTests(unittest.TestCase):
    def test_load_passports_returns_handle_accounts(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            write_activity_seed_data(data_dir)

            passports = load_passports(data_dir)

            self.assertEqual(passports["PASS-04271"]["handle"], "RED-LINE-27")

    def test_log_activity_writes_record_and_event_for_passport_identity(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            activity_dir = root / "activity"
            log_path = root / "events.jsonl"
            write_activity_seed_data(data_dir)

            record = log_activity(
                data_dir,
                activity_dir,
                passport_id="PASS-04271",
                service_address="020184",
                action="WORKSHOP-COMPLETE",
                source="packet-clearing",
                log_path=log_path,
                created_at="2028-07-01T10:00:00-07:00",
            )

            self.assertEqual(record["activity_id"], "ACT-000001")
            self.assertEqual(record["identity_kind"], "passport")
            self.assertEqual(record["identity_id"], "PASS-04271")
            self.assertEqual(record["handle"], "RED-LINE-27")
            self.assertEqual(record["status"], "cleared")
            self.assertEqual(read_activity_records(activity_dir), [record])
            self.assertEqual(read_events(log_path)[0]["type"], "activity.logged")

    def test_log_activity_rejects_unknown_passport(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            write_activity_seed_data(data_dir)

            with self.assertRaises(ValueError):
                log_activity(
                    data_dir,
                    root / "activity",
                    passport_id="PASS-MISSING",
                    service_address="020184",
                    action="WORKSHOP-COMPLETE",
                    source="packet-clearing",
                )

    def test_list_badges_renders_requirements(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            write_activity_seed_data(data_dir)

            rendered = list_badges(data_dir)

            self.assertIn("BADGE: FIELD-COURIER", rendered)
            self.assertIn("REQ 1  CALL DIRECTORY", rendered)

    def test_render_activity_receipt_is_printable(self):
        record = {
            "activity_id": "ACT-000001",
            "identity_id": "PASS-04271",
            "handle": "RED-LINE-27",
            "service_address": "020184",
            "action": "WORKSHOP-COMPLETE",
            "status": "cleared",
            "created_at": "2028-07-01T10:00:00-07:00",
        }

        rendered = render_activity_receipt(record)

        self.assertIn("OMNIDAT ACTIVITY CLEARING", rendered)
        self.assertIn("ACTIVITY: ACT-000001", rendered)
        self.assertIn("PASS-04271 RED-LINE-27", rendered)


def write_activity_seed_data(data_dir: Path) -> None:
    data_dir.mkdir()
    (data_dir / "activity-passports.sample.json").write_text(
        json.dumps(
            [
                {
                    "passport_id": "PASS-04271",
                    "handle": "RED-LINE-27",
                    "access_class": "PASSPORT",
                    "status": "active",
                }
            ]
        )
    )
    (data_dir / "badges.sample.json").write_text(
        json.dumps(
            [
                {
                    "badge_id": "FIELD-COURIER",
                    "name": "Field Courier",
                    "requirements": [
                        "CALL DIRECTORY",
                        "DELIVER MESSAGE",
                    ],
                }
            ]
        )
    )


if __name__ == "__main__":
    unittest.main()
