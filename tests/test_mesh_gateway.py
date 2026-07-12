import json
import tempfile
import unittest
from pathlib import Path
from urllib.request import Request

from tools.omnidat_bridge import MatrixBridge
from tools.omnidat_mesh_gateway import MeshGateway, chunk_for_mesh, load_mesh_nodes


REGISTERED_NODE = "!e2e30001"
UNKNOWN_NODE = "!deadbeef"


class MeshGatewayDispatchTests(unittest.TestCase):
    def test_unknown_node_is_guest_and_msg_clears_access_barred(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(UNKNOWN_NODE, "MSG 042713 HELLO")

            self.assertIn("CLR NA C:11 D:70", response)
            self.assertEqual(transport.requests, [])

    def test_registered_node_msg_sends_via_bridge(self):
        with gateway_env() as (gateway, transport):
            transport.route("POST", "/dm/send", {"rcpt": "MSG-00482", "eventId": "$evt"})

            response = gateway.handle_text(REGISTERED_NODE, "MSG 042713 SEE YOU AT MILIWAYS")

            self.assertIn("MSG SENT RCPT MSG-00482 CLR 00", response)
            request = transport.requests[0]
            self.assertEqual(request.full_url, "http://bridge.test/dm/send")
            self.assertEqual(
                json.loads(request.data.decode("utf-8")),
                {"from": "041027", "to": "042713", "body": "SEE YOU AT MILIWAYS"},
            )

    def test_msg_outside_subscriber_namespace_clears_np(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(REGISTERED_NODE, "MSG 000001 HELLO")

            self.assertIn("CLR NP C:13 D:67", response)
            self.assertEqual(transport.requests, [])

    def test_mail_returns_mailbox_and_marks_read(self):
        with gateway_env() as (gateway, transport):
            transport.route(
                "GET",
                "/dm/mailbox/041027",
                {"items": [{"no": 1, "from": "042713", "ts": "18:42", "body": "HI"}]},
            )
            transport.route("POST", "/dm/read", {"ok": True})

            response = gateway.handle_text(REGISTERED_NODE, "MAIL")

            self.assertIn("OMNIDAT SUBSCRIBER MAIL  041027", response)
            self.assertIn("001 FROM 042713", response)
            self.assertIn("END OF MAIL", response)
            paths = [request.full_url for request in transport.requests]
            self.assertIn("http://bridge.test/dm/read", paths)

    def test_mail_empty_does_not_mark_read(self):
        with gateway_env() as (gateway, transport):
            transport.route("GET", "/dm/mailbox/041027", {"items": []})

            response = gateway.handle_text(REGISTERED_NODE, "MAIL")

            self.assertIn("NO MAIL", response)
            paths = [request.full_url for request in transport.requests]
            self.assertNotIn("http://bridge.test/dm/read", paths)

    def test_guest_mail_clears_access_barred(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(UNKNOWN_NODE, "MAIL")

            self.assertIn("CLR NA C:11 D:70", response)

    def test_call_board_address_reads_page(self):
        with gateway_env() as (gateway, transport):
            transport.route(
                "GET",
                "/board/GEN/page",
                {"items": [{"no": 482, "poster": "Anonymous", "ts": 1783877642908, "body": "ANYONE SELLING A 9V?"}]},
            )

            response = gateway.handle_text(UNKNOWN_NODE, "CALL 000401")

            self.assertIn("OMNIDAT PUBLIC BOARD /GEN/", response)
            self.assertIn("No.00482", response)
            self.assertIn("CLR 00", response)

    def test_call_board_by_id_reads_page(self):
        with gateway_env() as (gateway, transport):
            transport.route("GET", "/board/GEN/page", {"items": []})

            response = gateway.handle_text(UNKNOWN_NODE, "CALL GEN")

            self.assertIn("OMNIDAT PUBLIC BOARD /GEN/", response)
            self.assertIn("NO POSTS", response)

    def test_call_non_board_delegates_to_radio_pad(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(UNKNOWN_NODE, "CALL 020184")

            self.assertIn("CAMP LAMINAR MESSAGE DESK", response)
            self.assertEqual(transport.requests, [])

    def test_post_public_board_omits_identity_ctx(self):
        with gateway_env() as (gateway, transport):
            transport.route("POST", "/board/GEN/post", {"no": 483, "eventId": "$evt"})

            response = gateway.handle_text(REGISTERED_NODE, "POST GEN GOT ONE")

            self.assertIn("RCPT No.00483 CLR 00", response)
            payload = json.loads(transport.requests[0].data.decode("utf-8"))
            self.assertEqual(payload["ctx"], {"transport": "mesh"})
            self.assertEqual(payload["body"], "GOT ONE")
            self.assertNotIn("name", payload)

    def test_guest_can_post_public_board(self):
        with gateway_env() as (gateway, transport):
            transport.route("POST", "/board/GEN/post", {"no": 485, "eventId": "$evt"})

            response = gateway.handle_text(UNKNOWN_NODE, "POST GEN GOT ONE")

            self.assertIn("RCPT No.00485 CLR 00", response)
            payload = json.loads(transport.requests[0].data.decode("utf-8"))
            self.assertEqual(payload["ctx"], {"transport": "mesh"})

    def test_post_with_tripcode_name(self):
        with gateway_env() as (gateway, transport):
            transport.route("POST", "/board/GEN/post", {"no": 484, "eventId": "$evt"})

            gateway.handle_text(REGISTERED_NODE, "POST GEN Froody#hunter2 GOT ONE")

            payload = json.loads(transport.requests[0].data.decode("utf-8"))
            self.assertEqual(payload["name"], "Froody#hunter2")
            self.assertEqual(payload["body"], "GOT ONE")

    def test_post_gated_board_includes_passport_ctx(self):
        with gateway_env() as (gateway, transport):
            transport.route("POST", "/board/OPS/post", {"no": 12, "eventId": "$evt"})

            gateway.handle_text(REGISTERED_NODE, "POST OPS STATUS GREEN")

            payload = json.loads(transport.requests[0].data.decode("utf-8"))
            self.assertEqual(payload["ctx"]["passport"], "041027")
            self.assertEqual(payload["ctx"]["transport"], "mesh")
            self.assertIn("session_id", payload["ctx"])

    def test_guest_cannot_post_gated_board(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(UNKNOWN_NODE, "POST OPS STATUS GREEN")

            self.assertIn("CLR NA C:11 D:70", response)
            self.assertEqual(transport.requests, [])

    def test_dir_delegates_to_radio_pad(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(UNKNOWN_NODE, "DIR")

            self.assertIn("OMNIDAT FIELD PAD", response)
            self.assertIn("000001 OMNIDAT DIRECTORY", response)

    def test_help_includes_messaging_verbs(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(UNKNOWN_NODE, "HELP")

            self.assertIn("MSG <ADDR> <TEXT>", response)
            self.assertIn("MAIL", response)
            self.assertIn("POST <BOARD>", response)

    def test_unknown_verb_clears_err(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(UNKNOWN_NODE, "BOGUS THING")

            self.assertIn("CLR ERR C:19 D:0", response)

    def test_msg_usage_error_clears_err(self):
        with gateway_env() as (gateway, transport):
            response = gateway.handle_text(REGISTERED_NODE, "MSG 042713")

            self.assertIn("CLR ERR C:19 D:0", response)

    def test_respond_chunks_to_mesh_limit(self):
        with gateway_env() as (gateway, transport):
            transport.route(
                "GET",
                "/board/GEN/page",
                {
                    "items": [
                        {"no": n, "poster": "Anonymous", "ts": 1783877642908, "body": "X" * 60}
                        for n in range(1, 9)
                    ]
                },
            )

            chunks = gateway.respond(UNKNOWN_NODE, "CALL GEN")

            self.assertGreater(len(chunks), 1)
            for chunk in chunks:
                self.assertLessEqual(len(chunk.encode("utf-8")), gateway.mesh_limit)
            self.assertTrue(chunks[0].startswith("1/"))


class ChunkingTests(unittest.TestCase):
    def test_short_text_passes_through_unprefixed(self):
        self.assertEqual(chunk_for_mesh("CLR 00", limit=200), ["CLR 00"])

    def test_long_text_splits_on_lines_with_ordinals(self):
        text = "\n".join(f"LINE {n:03d}" for n in range(50))

        chunks = chunk_for_mesh(text, limit=100)

        self.assertGreater(len(chunks), 1)
        total = len(chunks)
        for index, chunk in enumerate(chunks, start=1):
            self.assertLessEqual(len(chunk.encode("utf-8")), 100)
            self.assertTrue(chunk.startswith(f"{index}/{total} "))
        reassembled = "\n".join(
            chunk.split(" ", 1)[1] for chunk in chunks
        )
        self.assertEqual(reassembled, text)

    def test_single_overlong_line_is_hard_split(self):
        chunks = chunk_for_mesh("A" * 500, limit=100)

        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(len(chunk.encode("utf-8")), 100)


class MailNotifierTests(unittest.TestCase):
    def test_notifies_once_per_new_mail_count(self):
        with gateway_env() as (gateway, transport):
            transport.route(
                "GET",
                "/dm/mailbox/041027",
                {"items": [{"no": 1, "from": "042713", "ts": "18:42", "body": "HI"}]},
            )
            sent: list[tuple[str, str]] = []

            gateway.poll_notifications(lambda node, text: sent.append((node, text)))
            gateway.poll_notifications(lambda node, text: sent.append((node, text)))

            self.assertEqual(len(sent), 1)
            self.assertEqual(sent[0][0], REGISTERED_NODE)
            self.assertIn("1 NEW MSG", sent[0][1])

    def test_notifies_again_when_count_rises(self):
        with gateway_env() as (gateway, transport):
            transport.route(
                "GET",
                "/dm/mailbox/041027",
                {"items": [{"no": 1, "from": "042713", "ts": "18:42", "body": "HI"}]},
            )
            sent: list[tuple[str, str]] = []
            gateway.poll_notifications(lambda node, text: sent.append((node, text)))

            transport.route(
                "GET",
                "/dm/mailbox/041027",
                {
                    "items": [
                        {"no": 1, "from": "042713", "ts": "18:42", "body": "HI"},
                        {"no": 2, "from": "042713", "ts": "18:44", "body": "AGAIN"},
                    ]
                },
            )
            gateway.poll_notifications(lambda node, text: sent.append((node, text)))

            self.assertEqual(len(sent), 2)
            self.assertIn("2 NEW MSG", sent[1][1])

    def test_bridge_outage_is_skipped_silently(self):
        with gateway_env() as (gateway, transport):
            transport.fail_with_unreachable = True
            sent: list[tuple[str, str]] = []

            gateway.poll_notifications(lambda node, text: sent.append((node, text)))

            self.assertEqual(sent, [])


class MeshNodeRegistryTests(unittest.TestCase):
    def test_load_mesh_nodes_maps_node_to_account(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            write_seed_data(data_dir)

            nodes = load_mesh_nodes(data_dir)

            self.assertEqual(nodes[REGISTERED_NODE], "ACCT-000001")

    def test_missing_registry_is_empty(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            self.assertEqual(load_mesh_nodes(Path(temp_dir)), {})


# ---- Test environment ------------------------------------------------------


class gateway_env:
    def __enter__(self):
        self._tmp = tempfile.TemporaryDirectory()
        data_dir = Path(self._tmp.name) / "data"
        write_seed_data(data_dir)
        self.transport = RoutingTransport()
        bridge = MatrixBridge(
            base_url="http://bridge.test",
            secret="test-secret",
            transport=self.transport,
        )
        gateway = MeshGateway(data_dir=data_dir, bridge=bridge)
        return gateway, self.transport

    def __exit__(self, _exc_type, _exc_value, _traceback):
        self._tmp.cleanup()
        return None


class RoutingTransport:
    """Routes bridge requests by method+path, recording every request."""

    def __init__(self):
        self.routes: dict[tuple[str, str], dict] = {}
        self.requests: list[Request] = []
        self.fail_with_unreachable = False

    def route(self, method: str, path: str, payload: dict) -> None:
        self.routes[(method, path)] = payload

    def __call__(self, request: Request):
        if self.fail_with_unreachable:
            raise ConnectionError("bridge unreachable")
        self.requests.append(request)
        path = request.full_url.replace("http://bridge.test", "").split("?")[0]
        payload = self.routes.get((request.get_method(), path))
        if payload is None:
            raise AssertionError(f"unrouted bridge request {request.get_method()} {path}")
        return FakeResponse(payload)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc_value, _traceback):
        return None

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def write_seed_data(data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "packet-services.json").write_text(
        json.dumps(
            [
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
                    "description": "General pseudo-anonymous message board",
                    "board": {"board_id": "GEN", "read_class": "PUBLIC", "post_class": "PUBLIC"},
                },
                {
                    "address": "030041",
                    "name": "EVENT OPS BOARD",
                    "access_class": "PUBLIC",
                    "description": "Passport-gated ops board",
                    "board": {"board_id": "OPS", "read_class": "PUBLIC", "post_class": "PASSPORT"},
                },
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
                    "transports": ["hosted-node", "meshcore-radio-pad"],
                    "description": "Campsite message desk",
                }
            ]
        )
    )
    (data_dir / "packet-namespaces.sample.json").write_text(
        json.dumps(
            [
                {
                    "namespace_id": "subscriber-messaging",
                    "range_start": "040000",
                    "range_end": "049999",
                    "label": "Subscriber messaging addresses",
                    "service_class": "SUBSCRIBER",
                    "provisioning": "passport-minted",
                    "directory_status": "unlisted",
                }
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
                    "packet_permissions": ["DIRECTORY"],
                    "status": "active",
                    "subscriber_address": "041027",
                },
            ]
        )
    )
    (data_dir / "mesh-nodes.sample.json").write_text(
        json.dumps(
            [
                {
                    "node_id": REGISTERED_NODE,
                    "account_id": "ACCT-000001",
                    "label": "Field tester radio",
                }
            ]
        )
    )


if __name__ == "__main__":
    unittest.main()
