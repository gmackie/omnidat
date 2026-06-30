import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_events import append_event, read_events, render_daily_summary, summarize_events


class EventLedgerTests(unittest.TestCase):
    def test_append_event_writes_jsonl_with_sequential_event_id(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "events.jsonl"

            first = append_event(
                log_path,
                "call.ended",
                "pbx",
                {"called": "8800", "disposition": "answered"},
                created_at="2028-07-01T10:00:00-07:00",
            )
            second = append_event(
                log_path,
                "fax.received",
                "document-services",
                {"pages": 2},
                created_at="2028-07-01T10:01:00-07:00",
            )

            self.assertEqual(first["event_id"], "EVT-20280701-000001")
            self.assertEqual(second["event_id"], "EVT-20280701-000002")
            self.assertEqual(len(log_path.read_text().splitlines()), 2)
            self.assertEqual(json.loads(log_path.read_text().splitlines()[0])["type"], "call.ended")

    def test_read_events_ignores_blank_lines(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            log_path = Path(temp_dir) / "events.jsonl"
            log_path.write_text(
                "\n"
                + json.dumps(
                    {
                        "event_id": "EVT-20280701-000001",
                        "type": "print.printed",
                        "source": "document-services",
                        "created_at": "2028-07-01T10:00:00-07:00",
                        "payload": {"queue": "logs"},
                    }
                )
                + "\n\n"
            )

            events = read_events(log_path)

            self.assertEqual(len(events), 1)
            self.assertEqual(events[0]["type"], "print.printed")

    def test_summarize_events_counts_operational_categories(self):
        events = [
            event("call.ended", {"disposition": "answered"}),
            event("call.ended", {"disposition": "busy"}),
            event("call.ended", {"disposition": "intercept"}),
            event("session.ended", {"kind": "pad"}),
            event("session.ended", {"kind": "bbs"}),
            event("fax.received", {"pages": 1}),
            event("print.printed", {"queue": "receipts"}),
            event("media.request.created", {"tape_id": "PUB-0001"}),
            event("queue.order.accepted", {"ticket_id": "MLY-000001"}),
            event("activity.logged", {"activity_id": "ACT-000001"}),
            event("incident.opened", {"class": "MEDIA"}),
        ]

        summary = summarize_events(events)

        self.assertEqual(summary["calls_completed"], 1)
        self.assertEqual(summary["busy_or_intercepts"], 2)
        self.assertEqual(summary["pad_sessions"], 1)
        self.assertEqual(summary["bbs_sessions"], 1)
        self.assertEqual(summary["faxes_received"], 1)
        self.assertEqual(summary["print_jobs"], 1)
        self.assertEqual(summary["media_requests"], 1)
        self.assertEqual(summary["queue_orders"], 1)
        self.assertEqual(summary["activities_logged"], 1)
        self.assertEqual(summary["incidents"], 1)

    def test_render_daily_summary_is_dot_matrix_friendly(self):
        summary = {
            "calls_completed": 3,
            "busy_or_intercepts": 1,
            "pad_sessions": 2,
            "bbs_sessions": 1,
            "faxes_received": 1,
            "print_jobs": 4,
            "media_requests": 2,
            "queue_orders": 5,
            "activities_logged": 6,
            "incidents": 0,
        }

        rendered = render_daily_summary("2028-07-01", summary)

        self.assertIn("OMNIDAT DAILY SUMMARY", rendered)
        self.assertIn("DATE: 2028-07-01", rendered)
        self.assertIn("CALLS COMPLETED: 3", rendered)
        self.assertIn("BUSY/INTERCEPTS: 1", rendered)
        self.assertIn("QUEUE ORDERS: 5", rendered)
        self.assertIn("ACTIVITIES LOGGED: 6", rendered)
        self.assertNotIn("\u2014", rendered)


def event(event_type: str, payload: dict) -> dict:
    return {
        "event_id": "EVT-20280701-000000",
        "type": event_type,
        "source": "test",
        "created_at": "2028-07-01T10:00:00-07:00",
        "payload": payload,
    }


if __name__ == "__main__":
    unittest.main()
