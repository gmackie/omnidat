import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from tools.omnidat_ui import (
    build_state,
    handle_health,
    handle_radio_query,
    handle_state,
    render_home,
)


class UiTests(unittest.TestCase):
    def test_build_state_summarizes_apps_passports_orders_and_activity(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            activity_dir = root / "activity"
            write_ui_seed_data(data_dir, queue_dir, activity_dir)

            state = build_state(data_dir, queue_dir, activity_dir)

            self.assertEqual(state["app_count"], 1)
            self.assertEqual(state["passport_count"], 1)
            self.assertEqual(state["order_count"], 1)
            self.assertEqual(state["activity_count"], 1)

    def test_render_home_contains_usable_field_office_controls(self):
        state = {
            "apps": [
                {
                    "address": "020184",
                    "app_name": "Camp Laminar Message Desk",
                    "template": "MESSAGE_DESK",
                    "directory_status": "provisional",
                    "status": "active",
                }
            ],
            "passports": [{"passport_id": "PASS-04271", "handle": "RED-LINE-27"}],
            "orders": [],
            "activities": [],
            "app_count": 1,
            "passport_count": 1,
            "order_count": 0,
            "activity_count": 0,
        }

        html = render_home(state)

        self.assertIn("OMNIDAT Field Office", html)
        self.assertIn("Camp Laminar Message Desk", html)
        self.assertIn("name=\"command\"", html)

    def test_handle_radio_query_returns_preformatted_radio_pad_response(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            write_ui_seed_data(data_dir, root / "queue", root / "activity")
            query = parse_qs(urlparse("/radio?command=DIR").query)

            status, headers, body = handle_radio_query(
                query,
                data_dir=data_dir,
                queue_dir=root / "queue",
                activity_dir=root / "activity",
                log_path=root / "events.jsonl",
            )

            self.assertEqual(status, 200)
            self.assertEqual(headers["Content-Type"], "text/html; charset=utf-8")
            self.assertIn("<pre>", body)
            self.assertIn("020184 CAMP LAMINAR MESSAGE DESK", body)

    def test_handle_health_reports_ready_runtime_when_data_files_exist(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            activity_dir = root / "activity"
            write_ui_seed_data(data_dir, queue_dir, activity_dir)

            status, headers, body = handle_health(data_dir, queue_dir, activity_dir)
            payload = json.loads(body)

            self.assertEqual(status, 200)
            self.assertEqual(headers["Content-Type"], "application/json")
            self.assertEqual(payload["status"], "healthy")
            self.assertEqual(payload["service"], "omnidat-field-office")
            self.assertEqual(payload["checks"]["seed_data"]["status"], "pass")
            self.assertEqual(payload["checks"]["runtime_dirs"]["status"], "pass")

    def test_handle_health_reports_unhealthy_when_seed_data_missing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)

            status, _headers, body = handle_health(root / "missing", root / "queue", root / "activity")
            payload = json.loads(body)

            self.assertEqual(status, 503)
            self.assertEqual(payload["status"], "unhealthy")
            self.assertEqual(payload["checks"]["seed_data"]["status"], "fail")

    def test_handle_state_returns_machine_readable_field_office_state(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            activity_dir = root / "activity"
            write_ui_seed_data(data_dir, queue_dir, activity_dir)

            status, headers, body = handle_state(data_dir, queue_dir, activity_dir)
            payload = json.loads(body)

            self.assertEqual(status, 200)
            self.assertEqual(headers["Content-Type"], "application/json")
            self.assertEqual(payload["service"], "omnidat-field-office")
            self.assertEqual(payload["status"], "healthy")
            self.assertIn("counts", payload)
            self.assertEqual(payload["counts"]["apps"], payload["counts"]["apps"])
            self.assertIn("apps", payload["state"])
            self.assertIn("passports", payload["state"])
            self.assertIn("timestamp", payload)
            # No field kit journal present in a fresh runtime dir.
            self.assertEqual(payload["journal"]["present"], False)

    def test_handle_state_reports_journal_when_present(self):
        from tools.omnidat_journal import JournalStore

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            activity_dir = root / "activity"
            write_ui_seed_data(data_dir, queue_dir, activity_dir)
            store = JournalStore(root / "field-kit-journal.db", source_id="field-kit-01")
            store.set_authority("event-1", "field-kit-01", 3)
            store.append("event-1", "queue.order.accepted", {"ticket": "MLY-1"})
            store.close()

            status, _headers, body = handle_state(
                data_dir, queue_dir, activity_dir, journal_db=root / "field-kit-journal.db"
            )
            payload = json.loads(body)

            self.assertEqual(status, 200)
            self.assertEqual(payload["journal"]["present"], True)
            self.assertEqual(payload["journal"]["source_id"], "field-kit-01")
            self.assertEqual(payload["journal"]["total"], 1)
            self.assertEqual(payload["journal"]["unpushed"], 1)


def write_ui_seed_data(data_dir: Path, queue_dir: Path, activity_dir: Path) -> None:
    data_dir.mkdir()
    queue_dir.mkdir()
    activity_dir.mkdir()
    (data_dir / "packet-services.json").write_text(
        json.dumps(
            [
                {
                    "address": "000001",
                    "name": "OMNIDAT DIRECTORY",
                    "access_class": "PUBLIC",
                    "description": "Packet service directory",
                }
            ]
        )
    )
    (data_dir / "campsite-apps.sample.json").write_text(
        json.dumps(
            [
                {
                    "address": "020184",
                    "owner_name": "Camp Laminar",
                    "app_name": "Camp Laminar Message Desk",
                    "template": "MESSAGE_DESK",
                    "access_class": "PUBLIC",
                    "directory_status": "provisional",
                    "status": "active",
                    "transports": ["hosted-node"],
                    "description": "Campsite message desk",
                }
            ]
        )
    )
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
    (data_dir / "queue-apps.sample.json").write_text(
        json.dumps(
            [
                {
                    "queue_id": "miliways",
                    "name": "Miliways",
                    "ticket_prefix": "MLY",
                    "service_address": "020501",
                    "items": [{"item_id": "tea", "name": "Tea", "status": "available"}],
                }
            ]
        )
    )
    (queue_dir / "orders.json").write_text(
        json.dumps(
            [
                {
                    "ticket_id": "MLY-000001",
                    "status": "accepted",
                    "passport_id": "PASS-04271",
                }
            ]
        )
    )
    (activity_dir / "activity-records.jsonl").write_text(
        json.dumps({"activity_id": "ACT-000001", "identity_id": "PASS-04271"}) + "\n"
    )


if __name__ == "__main__":
    unittest.main()
