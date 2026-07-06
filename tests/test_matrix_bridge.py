import json
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request

from tools.omnidat_bridge import (
    ClearedError,
    MatrixBridge,
    cleared_for_status,
    format_board_page,
    format_mailbox,
    format_post_receipt,
    format_send_receipt,
)


class MatrixBridgeTests(unittest.TestCase):
    def test_send_dm_posts_with_shared_secret(self):
        transport = FakeTransport({"rcpt": "MSG-00482", "eventId": "$evt"})
        bridge = MatrixBridge(
            base_url="http://127.0.0.1:8090/",
            secret="bridge-secret",
            transport=transport,
        )

        receipt = bridge.send_dm("041027", "042713", "SEE YOU AT MILIWAYS")

        self.assertEqual(receipt["rcpt"], "MSG-00482")
        request = transport.requests[0]
        self.assertEqual(request.full_url, "http://127.0.0.1:8090/dm/send")
        self.assertEqual(request.headers["X-omnidat-secret"], "bridge-secret")
        self.assertEqual(
            json.loads(request.data.decode("utf-8")),
            {"from": "041027", "to": "042713", "body": "SEE YOU AT MILIWAYS"},
        )

    def test_mailbox_gets_items(self):
        transport = FakeTransport(
            {"items": [{"no": 1, "from": "041027", "ts": "18:42", "body": "HI"}]}
        )
        bridge = MatrixBridge(base_url="http://bridge", secret="s", transport=transport)

        items = bridge.mailbox("042713")

        self.assertEqual(items[0]["from"], "041027")
        self.assertEqual(transport.requests[0].full_url, "http://bridge/dm/mailbox/042713")
        self.assertEqual(transport.requests[0].get_method(), "GET")

    def test_board_page_and_post(self):
        transport = FakeTransport({"items": []})
        bridge = MatrixBridge(base_url="http://bridge", secret="s", transport=transport)

        bridge.board_page("GEN", after=3)
        self.assertEqual(transport.requests[0].full_url, "http://bridge/board/GEN/page?after=3")

        transport.payload = {"no": 484}
        bridge.board_post("GEN", "GOT ONE", name="Froody#hunter2", ctx={"transport": "pad"})
        request = transport.requests[1]
        self.assertEqual(request.full_url, "http://bridge/board/GEN/post")
        self.assertEqual(
            json.loads(request.data.decode("utf-8")),
            {"body": "GOT ONE", "ctx": {"transport": "pad"}, "name": "Froody#hunter2"},
        )

    def test_unreachable_bridge_clears_der_cause_9(self):
        def transport(_request):
            raise URLError("connection refused")

        bridge = MatrixBridge(base_url="http://bridge", secret="s", transport=transport)

        with self.assertRaises(ClearedError) as caught:
            bridge.send_dm("041027", "042713", "HELLO")
        self.assertEqual(caught.exception.clr_line, "CLR DER C:9 D:0")

    def test_http_statuses_map_to_protocol_fidelity_clears(self):
        for status, clr in [
            (400, "CLR ERR C:19 D:0"),
            (401, "CLR RPE C:17 D:0"),
            (403, "CLR NA C:11 D:70"),
            (404, "CLR NP C:13 D:0"),
            (500, "CLR RPE C:17 D:0"),
        ]:
            def transport(_request, status=status):
                raise HTTPError("http://bridge", status, "err", None, None)

            bridge = MatrixBridge(base_url="http://bridge", secret="s", transport=transport)
            with self.assertRaises(ClearedError) as caught:
                bridge.mailbox("042713")
            self.assertEqual(caught.exception.clr_line, clr)

    def test_cleared_for_status_defaults_to_remote_procedure_error(self):
        self.assertEqual(cleared_for_status(502).clr_line, "CLR RPE C:17 D:0")


class FormattingTests(unittest.TestCase):
    def test_format_send_receipt(self):
        self.assertEqual(
            format_send_receipt({"rcpt": "MSG-00482"}),
            "MSG SENT RCPT MSG-00482 CLR 00",
        )

    def test_format_mailbox_with_items(self):
        rendered = format_mailbox(
            "042713",
            [{"no": 1, "from": "041027", "ts": "18:42", "body": "SEE YOU AT MILIWAYS"}],
        )

        self.assertEqual(
            rendered.splitlines(),
            [
                "OMNIDAT SUBSCRIBER MAIL  042713",
                "001 FROM 041027  18:42  SEE YOU AT MILIWAYS",
                "END OF MAIL   1 MSG",
                "CLR 00",
            ],
        )

    def test_format_mailbox_empty(self):
        rendered = format_mailbox("042713", [])

        self.assertEqual(
            rendered.splitlines(),
            ["OMNIDAT SUBSCRIBER MAIL  042713", "NO MAIL", "CLR 00"],
        )

    def test_format_board_page(self):
        rendered = format_board_page(
            "GEN",
            [
                {"no": 482, "poster": "Anonymous", "ts": "18:42", "body": "ANYONE SELLING A 9V?"},
                {"no": 483, "poster": "FROOD!x8sK2", "ts": "18:44", "body": "NITEMARKT STALL 4"},
            ],
        )

        self.assertEqual(
            rendered.splitlines(),
            [
                "OMNIDAT PUBLIC BOARD /GEN/",
                "No.00482 Anonymous            18:42  ANYONE SELLING A 9V?",
                "No.00483 FROOD!x8sK2          18:44  NITEMARKT STALL 4",
                "CLR 00",
            ],
        )

    def test_format_post_receipt(self):
        self.assertEqual(format_post_receipt({"no": 484}), "RCPT No.00484 CLR 00")


class FakeTransport:
    def __init__(self, payload):
        self.payload = payload
        self.requests: list[Request] = []

    def __call__(self, request):
        self.requests.append(request)
        return FakeResponse(self.payload)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc_value, _traceback):
        return None

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


if __name__ == "__main__":
    unittest.main()
