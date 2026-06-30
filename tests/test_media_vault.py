import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_events import read_events
from tools.omnidat_media_vault import (
    approve_next_request,
    complete_playback,
    create_request,
    initialize_state,
    load_state,
    mark_fault,
    start_playback,
)


class MediaVaultSimulatorTests(unittest.TestCase):
    def test_initialize_state_loads_available_tapes_from_catalog(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            catalog_path = write_catalog(root)
            state_path = root / "vault-state.json"

            state = initialize_state(catalog_path, state_path)

            self.assertEqual(state["state"], "IDLE")
            self.assertEqual(state["active_request_id"], None)
            self.assertEqual(state["tapes"]["PUB-0001"]["slot"], 1)
            self.assertEqual(state["queue"], [])
            self.assertEqual(load_state(state_path)["state"], "IDLE")

    def test_request_approve_start_complete_updates_state_and_events(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            catalog_path = write_catalog(root)
            state_path = root / "vault-state.json"
            log_path = root / "events.jsonl"
            initialize_state(catalog_path, state_path)

            request = create_request(
                state_path,
                "PUB-0001",
                source="pad",
                requested_by="ACCT-000001",
                log_path=log_path,
                created_at="2028-07-01T10:00:00-07:00",
            )
            approved = approve_next_request(
                state_path,
                operator_initials="MG",
                log_path=log_path,
                created_at="2028-07-01T10:01:00-07:00",
            )
            playing = start_playback(
                state_path,
                log_path=log_path,
                created_at="2028-07-01T10:02:00-07:00",
            )
            completed = complete_playback(
                state_path,
                log_path=log_path,
                created_at="2028-07-01T10:03:00-07:00",
            )

            self.assertEqual(request["request_id"], "VAULT-000001")
            self.assertEqual(approved["status"], "approved")
            self.assertEqual(playing["state"], "PLAYING")
            self.assertEqual(completed["state"], "IDLE")
            self.assertEqual(completed["active_request_id"], None)
            self.assertEqual(completed["tapes"]["PUB-0001"]["status"], "available")
            self.assertEqual(
                [event["type"] for event in read_events(log_path)],
                [
                    "media.request.created",
                    "media.request.approved",
                    "media.playback.started",
                    "media.playback.completed",
                ],
            )

    def test_unknown_tape_request_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            state_path = root / "vault-state.json"
            initialize_state(write_catalog(root), state_path)

            with self.assertRaisesRegex(ValueError, "UNKNOWN"):
                create_request(state_path, "UNKNOWN", source="pad", requested_by="ACCT-000001")

    def test_fault_blocks_playback_until_reinitialized(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            state_path = root / "vault-state.json"
            initialize_state(write_catalog(root), state_path)
            create_request(state_path, "PUB-0001", source="pad", requested_by="ACCT-000001")
            approve_next_request(state_path, operator_initials="MG")

            faulted = mark_fault(state_path, "jam detected", operator_initials="MG")

            self.assertEqual(faulted["state"], "FAULT")
            self.assertIn("jam detected", faulted["fault"]["reason"])
            with self.assertRaisesRegex(RuntimeError, "FAULT"):
                start_playback(state_path)


def write_catalog(root: Path) -> Path:
    catalog_path = root / "media-catalog.sample.json"
    catalog_path.write_text(
        json.dumps(
            [
                {
                    "tape_id": "PUB-0001",
                    "title": "Public Domain Feature 01",
                    "slot": 1,
                    "runtime_minutes": 72,
                    "rights": "public-domain",
                    "status": "available",
                }
            ]
        )
    )
    return catalog_path


if __name__ == "__main__":
    unittest.main()
