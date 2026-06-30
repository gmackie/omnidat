import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_events import read_events
from tools.omnidat_packet import (
    call_service,
    clear_session,
    list_directory,
    load_accounts,
    load_packet_services,
    start_session,
)


class PacketClearingTests(unittest.TestCase):
    def test_list_directory_renders_services_in_address_order(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))

            rendered = list_directory(load_packet_services(data_dir))

            self.assertIn("OMNIDAT PACKET CLEARING", rendered)
            self.assertLess(rendered.index("000001"), rendered.index("000002"))
            self.assertIn("000001  PUBLIC      OMNIDAT DIRECTORY", rendered)
            self.assertIn("000002  REGISTERED  ACCOUNT INQUIRY", rendered)

    def test_guest_can_call_public_service(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            log_path = Path(temp_dir) / "events.jsonl"
            session = start_session(
                endpoint_id="PAD-01",
                account_id="ACCT-GUEST",
                created_at="2028-07-01T10:00:00-07:00",
            )

            result = call_service(
                session,
                "000001",
                load_packet_services(data_dir),
                load_accounts(data_dir),
                log_path=log_path,
                created_at="2028-07-01T10:01:00-07:00",
            )

            self.assertEqual(result["remote_service"], "000001")
            self.assertEqual(result["status"], "connected")
            self.assertEqual(read_events(log_path)[0]["type"], "session.started")

    def test_guest_cannot_call_registered_service(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            session = start_session(
                endpoint_id="PAD-01",
                account_id="ACCT-GUEST",
                created_at="2028-07-01T10:00:00-07:00",
            )

            with self.assertRaisesRegex(PermissionError, "REGISTERED"):
                call_service(
                    session,
                    "000002",
                    load_packet_services(data_dir),
                    load_accounts(data_dir),
                )

    def test_registered_account_can_call_registered_service_and_clear(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            log_path = Path(temp_dir) / "events.jsonl"
            session = start_session(
                endpoint_id="PAD-02",
                account_id="ACCT-000001",
                created_at="2028-07-01T10:00:00-07:00",
            )
            connected = call_service(
                session,
                "000002",
                load_packet_services(data_dir),
                load_accounts(data_dir),
                log_path=log_path,
                created_at="2028-07-01T10:01:00-07:00",
            )

            cleared = clear_session(
                connected,
                clear_reason="user-cleared",
                log_path=log_path,
                created_at="2028-07-01T10:02:00-07:00",
            )

            self.assertEqual(cleared["status"], "cleared")
            self.assertEqual(cleared["clear_reason"], "user-cleared")
            self.assertEqual(
                [event["type"] for event in read_events(log_path)],
                ["session.started", "session.ended"],
            )

    def test_unknown_packet_address_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-GUEST")

            with self.assertRaisesRegex(ValueError, "999999"):
                call_service(
                    session,
                    "999999",
                    load_packet_services(data_dir),
                    load_accounts(data_dir),
                )


def write_packet_data(root: Path) -> Path:
    data_dir = root / "data"
    data_dir.mkdir()
    (data_dir / "packet-services.json").write_text(
        json.dumps(
            [
                {
                    "address": "000002",
                    "name": "ACCOUNT INQUIRY",
                    "access_class": "REGISTERED",
                    "description": "Account status and records",
                },
                {
                    "address": "000001",
                    "name": "OMNIDAT DIRECTORY",
                    "access_class": "PUBLIC",
                    "description": "Packet service directory",
                },
            ]
        )
    )
    (data_dir / "accounts.sample.json").write_text(
        json.dumps(
            [
                {
                    "account_id": "ACCT-GUEST",
                    "display_name": "PUBLIC GUEST",
                    "access_class": "PUBLIC",
                    "packet_permissions": ["DIRECTORY"],
                    "status": "active",
                },
                {
                    "account_id": "ACCT-000001",
                    "display_name": "REGISTERED USER",
                    "access_class": "REGISTERED",
                    "packet_permissions": ["DIRECTORY", "ACCOUNT_INQUIRY"],
                    "status": "active",
                },
            ]
        )
    )
    return data_dir


if __name__ == "__main__":
    unittest.main()
