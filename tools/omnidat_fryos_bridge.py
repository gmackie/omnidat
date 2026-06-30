from __future__ import annotations

import json
from typing import Any, Callable
from urllib.request import Request, urlopen


Transport = Callable[[Request], Any]


class FryosTrpcBridge:
    def __init__(
        self,
        base_url: str,
        operator_token: str,
        transport: Transport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.operator_token = operator_token
        self.transport = transport or urlopen

    def create_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._mutation("order.create", payload)

    def get_order(self, order_id: str) -> dict[str, Any] | None:
        return self._mutation("order.getById", {"id": order_id})

    def _mutation(self, procedure: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps({"json": payload}).encode("utf-8")
        request = Request(
            f"{self.base_url}/api/trpc/{procedure}",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.operator_token}",
                "Content-Type": "application/json",
            },
        )
        with self.transport(request) as response:
            decoded = json.loads(response.read().decode("utf-8"))
        return decoded["result"]["data"]["json"]
