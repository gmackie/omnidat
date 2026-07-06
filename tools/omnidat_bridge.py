from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_BRIDGE_URL = "http://127.0.0.1:8090"

Transport = Callable[[Request], Any]


class ClearedError(Exception):
    """A packet call that must clear with a real X.25 cause and diagnostic.

    Rendered per docs/protocol-fidelity.md as `CLR <signal> C:<cause> D:<diag>`.
    """

    def __init__(self, signal: str, cause: int, diagnostic: int, detail: str = "") -> None:
        self.signal = signal
        self.cause = cause
        self.diagnostic = diagnostic
        self.detail = detail
        super().__init__(self.clr_line)

    @property
    def clr_line(self) -> str:
        return f"CLR {self.signal} C:{self.cause} D:{self.diagnostic}"


def cleared_for_status(status: int, detail: str = "") -> ClearedError:
    """Map Bridge HTTP statuses to X.25 clears per docs/protocol-fidelity.md."""
    if status == 400:
        return ClearedError("ERR", 19, 0, detail)
    if status == 403:
        return ClearedError("NA", 11, 70, detail)
    if status == 404:
        return ClearedError("NP", 13, 0, detail)
    # 401 (secret mismatch) and 5xx: the remote service violated the
    # edge<->bridge contract mid-call.
    return ClearedError("RPE", 17, 0, detail)


class MatrixBridge:
    """Client for the OMNIDAT Matrix bridge internal HTTP API.

    Mirrors the FryosTrpcBridge pattern: env-driven base URL and token with
    an injectable transport for tests.
    """

    def __init__(
        self,
        base_url: str | None = None,
        secret: str | None = None,
        transport: Transport | None = None,
    ) -> None:
        self.base_url = (
            base_url or os.environ.get("OMNIDAT_BRIDGE_URL", DEFAULT_BRIDGE_URL)
        ).rstrip("/")
        self.secret = secret if secret is not None else os.environ.get("OMNIDAT_BRIDGE_SECRET", "")
        self.transport = transport or urlopen

    def send_dm(self, from_addr: str, to_addr: str, body: str) -> dict[str, Any]:
        return self._request("POST", "/dm/send", {"from": from_addr, "to": to_addr, "body": body})

    def mailbox(self, addr: str) -> list[dict[str, Any]]:
        return self._request("GET", f"/dm/mailbox/{addr}")["items"]

    def mark_read(self, addr: str) -> dict[str, Any]:
        return self._request("POST", "/dm/read", {"addr": addr})

    def board_page(self, board_id: str, after: int | None = None) -> list[dict[str, Any]]:
        path = f"/board/{board_id}/page"
        if after is not None:
            path += f"?after={after}"
        return self._request("GET", path)["items"]

    def board_post(
        self,
        board_id: str,
        body: str,
        name: str | None = None,
        thread: str | None = None,
        ctx: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"body": body, "ctx": ctx or {}}
        if name is not None:
            payload["name"] = name
        if thread is not None:
            payload["thread"] = thread
        return self._request("POST", f"/board/{board_id}/post", payload)

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        headers = {"x-omnidat-secret": self.secret}
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = Request(f"{self.base_url}{path}", data=data, method=method, headers=headers)
        try:
            with self.transport(request) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise cleared_for_status(error.code, detail=str(error)) from error
        except (URLError, ConnectionError, OSError, TimeoutError) as error:
            # Bridge offline or unreachable: the transport endpoint is down.
            raise ClearedError("DER", 9, 0, str(error)) from error


def terse_time(ts: Any) -> str:
    """Render a bridge timestamp as HH:MM.

    The mailbox API already returns terse HH:MM strings; board pages return
    epoch milliseconds.
    """
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts / 1000).astimezone().strftime("%H:%M")
    text = str(ts)
    if text.isdigit():
        return datetime.fromtimestamp(int(text) / 1000).astimezone().strftime("%H:%M")
    if "T" in text:
        return text[11:16]
    return text


def format_send_receipt(receipt: dict[str, Any]) -> str:
    return f"MSG SENT RCPT {receipt['rcpt']} CLR 00"


def format_mailbox(addr: str, items: list[dict[str, Any]]) -> str:
    lines = [f"OMNIDAT SUBSCRIBER MAIL  {addr}"]
    if not items:
        lines.append("NO MAIL")
    else:
        for item in items:
            lines.append(
                f"{item['no']:03d} FROM {item['from']}  {terse_time(item['ts'])}  {item['body']}"
            )
        lines.append(f"END OF MAIL {len(items):3d} MSG")
    lines.append("CLR 00")
    return "\n".join(lines)


def format_board_page(board_id: str, items: list[dict[str, Any]], read_class: str = "PUBLIC") -> str:
    lines = [f"OMNIDAT {read_class} BOARD /{board_id}/"]
    if not items:
        lines.append("NO POSTS")
    else:
        for item in items:
            # Pad the poster column so timestamps align; long tripcode posters
            # fall back to a single separating space rather than colliding.
            poster = item["poster"]
            poster_col = f"{poster:<20}" if len(poster) <= 20 else f"{poster} "
            lines.append(
                f"No.{item['no']:05d} {poster_col} {terse_time(item['ts'])}  {item['body']}"
            )
    lines.append("CLR 00")
    return "\n".join(lines)


def format_post_receipt(receipt: dict[str, Any]) -> str:
    return f"RCPT No.{receipt['no']:05d} CLR 00"


USAGE = """usage: bridge-msg <from> <to> <text...>   send a subscriber message
       bridge-msg mail <addr>             show unread subscriber mail
       bridge-msg read <addr>             advance the read marker"""


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    bridge = MatrixBridge()
    try:
        if len(args) == 2 and args[0] == "mail":
            print(format_mailbox(args[1], bridge.mailbox(args[1])))
            return 0
        if len(args) == 2 and args[0] == "read":
            bridge.mark_read(args[1])
            print("CLR 00")
            return 0
        if len(args) >= 3 and args[0] not in {"mail", "read"}:
            receipt = bridge.send_dm(args[0], args[1], " ".join(args[2:]))
            print(format_send_receipt(receipt))
            return 0
    except ClearedError as cleared:
        print(cleared.clr_line)
        return 1
    print(USAGE, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
