import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_bridge import ClearedError
from tools.omnidat_events import read_events
from tools.omnidat_packet import (
    board_post,
    board_read,
    call_service,
    clear_session,
    find_board_service,
    list_directory,
    load_accounts,
    load_packet_namespaces,
    load_packet_services,
    message_mail,
    message_send,
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


class SubscriberMessagingTests(unittest.TestCase):
    def test_msg_sends_dm_and_emits_session_and_message_events(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            log_path = Path(temp_dir) / "events.jsonl"
            bridge = FakeBridge()
            session = start_session(
                endpoint_id="PAD-01",
                account_id="ACCT-000001",
                created_at="2028-07-01T10:00:00-07:00",
            )

            connected, output = message_send(
                session,
                load_accounts(data_dir)["ACCT-000001"],
                "042713",
                "SEE YOU AT MILIWAYS",
                bridge,
                load_packet_namespaces(data_dir),
                log_path=log_path,
                created_at="2028-07-01T10:01:00-07:00",
            )

            self.assertEqual(output, "MSG SENT RCPT MSG-00482 CLR 00")
            self.assertEqual(connected["remote_service"], "000007")
            self.assertEqual(bridge.sent, [("041027", "042713", "SEE YOU AT MILIWAYS")])
            self.assertEqual(
                [event["type"] for event in read_events(log_path)],
                ["session.started", "message.sent"],
            )

    def test_guest_without_subscriber_address_is_barred(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-GUEST")

            with self.assertRaises(ClearedError) as caught:
                message_send(
                    session,
                    load_accounts(data_dir)["ACCT-GUEST"],
                    "042713",
                    "HELLO",
                    FakeBridge(),
                    load_packet_namespaces(data_dir),
                )

            self.assertEqual(caught.exception.clr_line, "CLR NA C:11 D:70")

    def test_msg_outside_subscriber_range_is_not_obtainable(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-000001")

            with self.assertRaises(ClearedError) as caught:
                message_send(
                    session,
                    load_accounts(data_dir)["ACCT-000001"],
                    "000001",
                    "HELLO",
                    FakeBridge(),
                    load_packet_namespaces(data_dir),
                )

            self.assertEqual(caught.exception.clr_line, "CLR NP C:13 D:67")

    def test_mail_renders_mailbox_and_advances_read_marker(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            log_path = Path(temp_dir) / "events.jsonl"
            bridge = FakeBridge(
                mailbox_items=[
                    {"no": 1, "from": "042713", "ts": "18:42", "body": "SEE YOU AT MILIWAYS"}
                ]
            )
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-000001")

            _, output = message_mail(
                session,
                load_accounts(data_dir)["ACCT-000001"],
                bridge,
                log_path=log_path,
            )

            self.assertEqual(
                output.splitlines(),
                [
                    "OMNIDAT SUBSCRIBER MAIL  041027",
                    "001 FROM 042713  18:42  SEE YOU AT MILIWAYS",
                    "END OF MAIL   1 MSG",
                    "CLR 00",
                ],
            )
            self.assertEqual(bridge.read, ["041027"])
            self.assertEqual(
                [event["type"] for event in read_events(log_path)],
                ["session.started", "mail.delivered"],
            )

    def test_empty_mailbox_does_not_advance_read_marker(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            bridge = FakeBridge()
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-000001")

            _, output = message_mail(
                session, load_accounts(data_dir)["ACCT-000001"], bridge
            )

            self.assertIn("NO MAIL", output)
            self.assertEqual(bridge.read, [])

    def test_public_board_read_by_guest_renders_page(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            service = find_board_service(load_packet_services(data_dir), "GEN")
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-GUEST")

            _, output = board_read(
                session, load_accounts(data_dir)["ACCT-GUEST"], service, FakeBridge()
            )

            self.assertIn("OMNIDAT PUBLIC BOARD /GEN/", output)
            self.assertIn("ANYONE SELLING A 9V?", output)

    def test_public_board_post_omits_passport_and_session(self):
        # The anonymity guarantee: a PUBLIC-post board must never receive
        # passport-linkable context from the edge.
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            service = find_board_service(load_packet_services(data_dir), "GEN")
            bridge = FakeBridge()
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-000001")

            board_post(
                session, load_accounts(data_dir)["ACCT-000001"], service, "HELLO", bridge
            )

            ctx = bridge.posts[0]["ctx"]
            self.assertNotIn("passport", ctx)
            self.assertNotIn("session_id", ctx)

    def test_gated_board_post_includes_passport(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            service = find_board_service(load_packet_services(data_dir), "OPS")
            bridge = FakeBridge()
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-000001")

            board_post(
                session, load_accounts(data_dir)["ACCT-000001"], service, "OPS NOTE", bridge
            )

            ctx = bridge.posts[0]["ctx"]
            self.assertEqual(ctx["passport"], "041027")
            self.assertIn("session_id", ctx)

    def test_guest_cannot_post_to_gated_board(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            service = find_board_service(load_packet_services(data_dir), "OPS")
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-GUEST")

            with self.assertRaises(ClearedError) as caught:
                board_post(
                    session, load_accounts(data_dir)["ACCT-GUEST"], service, "SNEAK", FakeBridge()
                )

            self.assertEqual(caught.exception.clr_line, "CLR NA C:11 D:70")

    def test_bridge_outage_clears_out_of_order(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = write_packet_data(Path(temp_dir))
            session = start_session(endpoint_id="PAD-01", account_id="ACCT-000001")

            with self.assertRaises(ClearedError) as caught:
                message_send(
                    session,
                    load_accounts(data_dir)["ACCT-000001"],
                    "042713",
                    "HELLO",
                    DownBridge(),
                    load_packet_namespaces(data_dir),
                )

            self.assertEqual(caught.exception.clr_line, "CLR DER C:9 D:0")


class FakeBridge:
    def __init__(self, mailbox_items=None):
        self.sent = []
        self.read = []
        self.posts = []
        self.mailbox_items = mailbox_items or []

    def send_dm(self, from_addr, to_addr, body):
        self.sent.append((from_addr, to_addr, body))
        return {"rcpt": "MSG-00482", "eventId": "$evt"}

    def mailbox(self, addr):
        return self.mailbox_items

    def mark_read(self, addr):
        self.read.append(addr)
        return {"ok": True}

    def board_page(self, board_id, after=None):
        return [
            {"no": 1, "poster": "Anonymous", "ts": "18:42", "body": "ANYONE SELLING A 9V?", "eventId": "$b1"},
        ]

    def board_post(self, board_id, body, name=None, thread=None, ctx=None):
        self.posts.append({"board_id": board_id, "body": body, "name": name, "thread": thread, "ctx": ctx})
        return {"no": 42}


class DownBridge:
    def send_dm(self, from_addr, to_addr, body):
        raise ClearedError("DER", 9, 0, "connection refused")

    def mailbox(self, addr):
        raise ClearedError("DER", 9, 0, "connection refused")

    def mark_read(self, addr):
        raise ClearedError("DER", 9, 0, "connection refused")


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
                {
                    "address": "000401",
                    "name": "OMNIDAT PUBLIC BOARD /GEN/",
                    "access_class": "PUBLIC",
                    "description": "General board",
                    "board": {"board_id": "GEN", "read_class": "PUBLIC", "post_class": "PUBLIC"},
                },
                {
                    "address": "000402",
                    "name": "OMNIDAT OPS BOARD /OPS/",
                    "access_class": "REGISTERED",
                    "description": "Passport-gated ops board",
                    "board": {"board_id": "OPS", "read_class": "PUBLIC", "post_class": "REGISTERED"},
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
                    "subscriber_address": "041027",
                },
            ]
        )
    )
    (data_dir / "packet-namespaces.sample.json").write_text(
        json.dumps(
            [
                {
                    "namespace_id": "core",
                    "range_start": "000000",
                    "range_end": "000999",
                    "label": "OMNIDAT core services",
                    "service_class": "CORE",
                    "provisioning": "manual",
                    "directory_status": "official",
                },
                {
                    "namespace_id": "subscriber-messaging",
                    "range_start": "040000",
                    "range_end": "049999",
                    "label": "Subscriber messaging addresses",
                    "service_class": "SUBSCRIBER",
                    "provisioning": "passport-minted",
                    "directory_status": "unlisted",
                },
            ]
        )
    )
    return data_dir


if __name__ == "__main__":
    unittest.main()
