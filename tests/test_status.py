import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_status import collect_status, render_status


class OperatorStatusTests(unittest.TestCase):
    def test_collect_status_counts_services_events_documents_and_media(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            spool_dir = root / "spool"
            fax_dir = root / "fax"
            data_dir.mkdir()
            (data_dir / "services.json").write_text(
                json.dumps(
                    [
                        {"number": "8800", "service_id": "trustdesk", "name": "TrustDesk"},
                        {"number": "8810", "service_id": "packet-main", "name": "Packet Clearing"},
                    ]
                )
            )
            event_log = root / "events.jsonl"
            event_log.write_text(
                "\n".join(
                    [
                        json.dumps({"type": "call.ended", "payload": {"disposition": "answered"}}),
                        json.dumps({"type": "session.ended", "payload": {"kind": "pad"}}),
                    ]
                )
                + "\n"
            )
            media_state = root / "media-state.json"
            media_state.write_text(json.dumps({"state": "PLAYING", "active_request_id": "VAULT-000001"}))
            (spool_dir / "receipts").mkdir(parents=True)
            (spool_dir / "receipts" / "PRINT-000001.txt").write_text("receipt")
            fax_dir.mkdir()
            (fax_dir / "FAX-000001.json").write_text("{}")

            status = collect_status(data_dir, event_log, media_state, spool_dir, fax_dir)

            self.assertEqual(status["services"], 2)
            self.assertEqual(status["calls_completed"], 1)
            self.assertEqual(status["pad_sessions"], 1)
            self.assertEqual(status["media_state"], "PLAYING")
            self.assertEqual(status["active_media_request"], "VAULT-000001")
            self.assertEqual(status["print_jobs"], 1)
            self.assertEqual(status["faxes"], 1)

    def test_render_status_is_operator_readable(self):
        rendered = render_status(
            {
                "services": 24,
                "calls_completed": 3,
                "busy_or_intercepts": 1,
                "pad_sessions": 2,
                "bbs_sessions": 1,
                "faxes_received": 1,
                "print_jobs": 4,
                "media_requests": 2,
                "incidents": 0,
                "media_state": "IDLE",
                "active_media_request": None,
                "faxes": 1,
            }
        )

        self.assertIn("OMNIDAT OPERATOR STATUS", rendered)
        self.assertIn("SERVICES: 24", rendered)
        self.assertIn("MEDIA VAULT: IDLE", rendered)
        self.assertIn("CALLS COMPLETED: 3", rendered)
        self.assertNotIn("\u2014", rendered)


if __name__ == "__main__":
    unittest.main()
