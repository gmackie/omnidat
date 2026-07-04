import io
import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_events import read_events
from tools.omnidat_journal import JournalStore
from tools.omnidat_sync import SyncClient, render_reconciliation_report


class FakeResponse:
    def __init__(self, body):
        self._body = json.dumps(body).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeTransport:
    def __init__(self, responses):
        self.responses = responses
        self.requests = []

    def __call__(self, request):
        self.requests.append(request)
        procedure = request.full_url.rsplit("/", 1)[-1]
        response = self.responses[procedure]
        if isinstance(response, Exception):
            raise response
        return FakeResponse({"result": {"data": {"json": response}}})


def push_report(**overrides):
    report = {
        "applied": 2,
        "duplicate": 0,
        "rejectedStale": 0,
        "quarantined": 0,
        "highWatermark": 2,
        "authority": {"holder": "field", "epoch": 1},
    }
    report.update(overrides)
    return report


class SyncClientTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.base = Path(self._tmp.name)
        self.store = JournalStore(self.base / "journal.db", source_id="field-kit-01")
        self.addCleanup(self.store.close)
        self.store.set_authority("event-1", "field-kit-01", 1)
        self.store.append("event-1", "queue.order.accepted", {"order": 1})
        self.store.append("event-1", "activity.logged", {"activity": 2})

    def make_client(self, transport, **kwargs):
        return SyncClient(
            self.store,
            base_url="https://cloud.test",
            token="sync-secret",
            event_id="event-1",
            transport=transport,
            **kwargs,
        )

    def test_push_sends_unpushed_entries_and_marks_them(self):
        transport = FakeTransport({"omnidat.syncPush": push_report()})
        client = self.make_client(transport)

        result = client.push()

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["report"]["applied"], 2)
        self.assertEqual(self.store.unpushed(), [])

        request = transport.requests[0]
        self.assertEqual(
            request.full_url, "https://cloud.test/api/trpc/omnidat.syncPush"
        )
        self.assertEqual(request.headers["Authorization"], "Bearer sync-secret")
        body = json.loads(request.data.decode("utf-8"))["json"]
        self.assertEqual(body["sourceId"], "field-kit-01")
        self.assertEqual(body["syncToken"], "sync-secret")
        self.assertEqual(
            [entry["idempotencyKey"] for entry in body["entries"]],
            ["field-kit-01:1", "field-kit-01:2"],
        )
        self.assertEqual(body["entries"][0]["opType"], "queue.order.accepted")
        self.assertEqual(body["entries"][0]["eventId"], "event-1")

    def test_push_transport_error_leaves_entries_unpushed(self):
        transport = FakeTransport({"omnidat.syncPush": OSError("uplink down")})
        client = self.make_client(transport)

        result = client.push()

        self.assertEqual(result["status"], "error")
        self.assertIn("uplink down", result["error"])
        self.assertEqual(len(self.store.unpushed()), 2)

    def test_pull_applies_entries_and_updates_watermarks_and_authority(self):
        transport = FakeTransport(
            {
                "omnidat.syncPull": {
                    "entries": [
                        {
                            "sourceId": "cloud",
                            "seq": 1,
                            "eventId": "event-1",
                            "epoch": 2,
                            "opType": "service.approved",
                            "payload": {"slug": "bulletin"},
                        },
                        {
                            "sourceId": "cloud",
                            "seq": 2,
                            "eventId": "event-1",
                            "epoch": 2,
                            "opType": "service.approved",
                            "payload": {"slug": "queue"},
                        },
                    ],
                    "authority": {
                        "holder": "cloud",
                        "holderSourceId": "cloud",
                        "epoch": 2,
                        "fenceSeq": 2,
                    },
                }
            }
        )
        applied = []
        client = self.make_client(transport, apply_entry=applied.append)

        result = client.pull()

        self.assertEqual(result["status"], "ok")
        self.assertEqual(len(applied), 2)
        self.assertEqual(applied[0]["opType"], "service.approved")
        self.assertEqual(self.store.watermark("cloud"), 2)
        self.assertEqual(self.store.current_epoch("event-1"), 2)
        self.assertEqual(self.store.current_holder("event-1"), "cloud")

        body = json.loads(transport.requests[0].data.decode("utf-8"))["json"]
        self.assertEqual(body["watermarks"], {})
        self.assertEqual(body["sourceId"], "field-kit-01")

    def test_sync_once_appends_a_sync_session_event(self):
        transport = FakeTransport(
            {
                "omnidat.syncPush": push_report(),
                "omnidat.syncPull": {
                    "entries": [],
                    "authority": {
                        "holder": "field",
                        "holderSourceId": "field-kit-01",
                        "epoch": 1,
                    },
                },
            }
        )
        event_log = self.base / "events.jsonl"
        client = self.make_client(transport, event_log=event_log)

        client.sync_once()

        events = read_events(event_log)
        session_events = [item for item in events if item["type"] == "sync.session"]
        self.assertEqual(len(session_events), 1)
        self.assertEqual(session_events[0]["payload"]["applied"], 2)
        self.assertEqual(session_events[0]["payload"]["pulled"], 0)

    def test_render_reconciliation_report_is_terse_and_uppercase(self):
        rendered = render_reconciliation_report(
            push_report(rejectedStale=1, quarantined=1)
        )

        self.assertIn("APPLIED: 2", rendered)
        self.assertIn("DUPLICATE: 0", rendered)
        self.assertIn("REJECTED STALE: 1", rendered)
        self.assertIn("QUARANTINED: 1", rendered)
        self.assertIn("AUTHORITY: FIELD (EPOCH 1)", rendered)


if __name__ == "__main__":
    unittest.main()
