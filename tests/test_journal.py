import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_journal import (
    JournalAuthorityError,
    JournalStore,
    payload_checksum,
)


class JournalStoreTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.path = Path(self._tmp.name) / "journal.db"
        self.store = JournalStore(self.path, source_id="field-kit-01")
        self.addCleanup(self.store.close)
        self.store.set_authority("event-1", "field-kit-01", 1)

    def test_append_assigns_monotonic_seq_and_idempotency_key(self):
        first = self.store.append("event-1", "queue.order.accepted", {"order": 1})
        second = self.store.append("event-1", "queue.order.accepted", {"order": 2})
        third = self.store.append("event-1", "activity.logged", {"activity": 3})

        self.assertEqual([first["seq"], second["seq"], third["seq"]], [1, 2, 3])
        self.assertEqual(first["idempotency_key"], "field-kit-01:1")
        self.assertEqual(third["idempotency_key"], "field-kit-01:3")
        self.assertEqual(first["epoch"], 1)
        self.assertEqual(first["event_id"], "event-1")
        self.assertTrue(first["recorded_at"])

    def test_append_refused_when_not_authority_holder(self):
        self.store.set_authority("event-1", "cloud", 2)

        with self.assertRaises(JournalAuthorityError) as refusal:
            self.store.append("event-1", "queue.order.accepted", {"order": 9})
        self.assertIn("authority", str(refusal.exception).lower())
        self.assertEqual(self.store.entries(), [])

    def test_unpushed_returns_ascending_and_mark_pushed_stamps(self):
        self.store.append("event-1", "queue.order.accepted", {"order": 1})
        self.store.append("event-1", "queue.order.accepted", {"order": 2})

        unpushed = self.store.unpushed()
        self.assertEqual([entry["seq"] for entry in unpushed], [1, 2])
        self.assertTrue(all(entry["pushed_at"] is None for entry in unpushed))

        self.store.mark_pushed([1])
        remaining = self.store.unpushed()
        self.assertEqual([entry["seq"] for entry in remaining], [2])
        self.assertIsNotNone(self.store.entries()[0]["pushed_at"])

    def test_payload_checksum_is_stable_sha256_over_sorted_json(self):
        payload = {"b": 1, "a": {"z": True, "m": "text"}}
        expected = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()

        entry = self.store.append("event-1", "queue.order.accepted", payload)

        self.assertEqual(entry["payload_checksum"], expected)
        self.assertEqual(payload_checksum(payload), expected)
        self.assertEqual(
            payload_checksum({"a": {"m": "text", "z": True}, "b": 1}), expected
        )

    def test_store_survives_reopen_without_sequence_reuse(self):
        self.store.append("event-1", "queue.order.accepted", {"order": 1})
        self.store.append("event-1", "queue.order.accepted", {"order": 2})
        self.store.close()

        reopened = JournalStore(self.path, source_id="field-kit-01")
        self.addCleanup(reopened.close)
        entry = reopened.append("event-1", "queue.order.accepted", {"order": 3})

        self.assertEqual(entry["seq"], 3)
        self.assertEqual(
            [item["seq"] for item in reopened.entries()], [1, 2, 3]
        )

    def test_current_epoch_defaults_to_zero(self):
        self.assertEqual(self.store.current_epoch("event-unknown"), 0)
        self.assertEqual(self.store.current_epoch("event-1"), 1)


if __name__ == "__main__":
    unittest.main()
