import json
import unittest
from urllib.request import Request

from tools.omnidat_fryos_bridge import FryosTrpcBridge


class FryosBridgeTests(unittest.TestCase):
    def test_create_order_posts_to_fryos_trpc_with_operator_token(self):
        transport = FakeTransport(
            {
                "result": {
                    "data": {
                        "json": {
                            "id": "order-1",
                            "orderNumber": 42,
                            "paymentStatus": "pending",
                        }
                    }
                }
            }
        )
        bridge = FryosTrpcBridge(
            base_url="https://fry.localhost/",
            operator_token="operator-secret",
            transport=transport,
        )

        result = bridge.create_order(
            {
                "source": "pos",
                "paymentMethod": "shadybucks",
                "items": [{"menuItemId": "menu-1", "quantity": 1, "modifiers": []}],
            }
        )

        self.assertEqual(result["id"], "order-1")
        self.assertEqual(transport.requests[0].full_url, "https://fry.localhost/api/trpc/order.create")
        self.assertEqual(transport.requests[0].headers["Authorization"], "Bearer operator-secret")
        self.assertEqual(
            json.loads(transport.requests[0].data.decode("utf-8")),
            {
                "json": {
                    "source": "pos",
                    "paymentMethod": "shadybucks",
                    "items": [{"menuItemId": "menu-1", "quantity": 1, "modifiers": []}],
                }
            },
        )

    def test_get_order_queries_fryos_trpc_by_order_id(self):
        transport = FakeTransport(
            {
                "result": {
                    "data": {
                        "json": {
                            "id": "order-1",
                            "status": "ready",
                            "paymentStatus": "charged",
                        }
                    }
                }
            }
        )
        bridge = FryosTrpcBridge(
            base_url="http://127.0.0.1:3000",
            operator_token="operator-secret",
            transport=transport,
        )

        result = bridge.get_order("order-1")

        self.assertEqual(result["status"], "ready")
        self.assertEqual(transport.requests[0].full_url, "http://127.0.0.1:3000/api/trpc/order.getById")
        self.assertEqual(json.loads(transport.requests[0].data.decode("utf-8")), {"json": {"id": "order-1"}})


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
