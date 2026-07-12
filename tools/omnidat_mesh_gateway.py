"""OMNIDAT Meshtastic gateway: the real Radio PAD transport.

Bridges Meshtastic direct messages onto the Packet Clearing edge. Incoming
text from a mesh node is parsed as a Radio PAD command; the messaging verbs
(MSG/MAIL/POST and board CALLs) ride the Matrix bridge through the same
gating helpers as the wired PAD (`tools/omnidat_packet.py`), and every other
verb falls through to the field PAD handler (`tools/omnidat_radio_pad.py`).

Identity stays at the edge: a mesh node id maps to an account via
`data/mesh-nodes.sample.json`; unregistered nodes act as ACCT-GUEST, which
bars MSG/MAIL with a real X.25 clear. The Bridge never learns about mesh
nodes — on PUBLIC-post boards the ctx carries only `transport: mesh`.

Runtime radio support (the `meshtastic` package) is imported lazily so the
simulation layer and tests never need radio dependencies.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Callable

from tools import omnidat_radio_pad as radio_pad
from tools.omnidat_bridge import ClearedError, MatrixBridge, format_delivery
from tools.omnidat_packet import (
    board_post,
    board_read,
    find_board_service,
    load_accounts,
    load_packet_namespaces,
    load_packet_services,
    message_mail,
    message_send,
    start_session,
)

# Meshtastic text payloads top out around 230 bytes; stay conservative so
# chunk prefixes and multibyte characters never push a frame over the limit.
DEFAULT_MESH_LIMIT = 200

GUEST_ACCOUNT_ID = "ACCT-GUEST"

MESH_HELP_EXTRA = [
    "MAIL",
    "SENT <RCPT>",
    "POST <BOARD> [NAME#TRIP] <TEXT>",
]


def load_mesh_nodes(data_dir: Path) -> dict[str, str]:
    """Map mesh node ids (!hex) to Packet Clearing account ids."""
    path = data_dir / "mesh-nodes.sample.json"
    if not path.exists():
        return {}
    return {
        entry["node_id"]: entry["account_id"]
        for entry in json.loads(path.read_text())
    }


def chunk_for_mesh(text: str, limit: int = DEFAULT_MESH_LIMIT) -> list[str]:
    """Split a PAD response into mesh-sized frames.

    Single-frame responses pass through untouched. Longer responses split on
    line boundaries (hard-splitting any single overlong line) and each frame
    is prefixed `i/n ` so a field operator can reassemble them in order.
    """
    if len(text.encode("utf-8")) <= limit:
        return [text]

    # Reserve room for the widest plausible ordinal prefix ("999/999 ").
    budget = limit - 8
    pieces: list[str] = []
    for line in text.splitlines():
        encoded = line.encode("utf-8")
        while len(encoded) > budget:
            head = encoded[:budget].decode("utf-8", errors="ignore")
            pieces.append(head)
            line = line[len(head):]
            encoded = line.encode("utf-8")
        pieces.append(line)

    chunks: list[str] = []
    current: list[str] = []
    current_size = 0
    for piece in pieces:
        piece_size = len(piece.encode("utf-8")) + (1 if current else 0)
        if current and current_size + piece_size > budget:
            chunks.append("\n".join(current))
            current = [piece]
            current_size = len(piece.encode("utf-8"))
        else:
            current.append(piece)
            current_size += piece_size
    if current:
        chunks.append("\n".join(current))

    total = len(chunks)
    return [f"{index}/{total} {chunk}" for index, chunk in enumerate(chunks, start=1)]


class MeshGateway:
    """Stateless-per-command dispatcher from mesh text to PAD services."""

    def __init__(
        self,
        data_dir: Path = Path("data"),
        bridge: MatrixBridge | None = None,
        log_path: Path | None = None,
        mesh_limit: int = DEFAULT_MESH_LIMIT,
    ) -> None:
        self.data_dir = data_dir
        self.bridge = bridge or MatrixBridge()
        self.log_path = log_path
        self.mesh_limit = mesh_limit
        self.nodes = load_mesh_nodes(data_dir)
        self.accounts = load_accounts(data_dir)
        self.packet_services = load_packet_services(data_dir)
        self.packet_namespaces = load_packet_namespaces(data_dir)
        self._notified_counts: dict[str, int] = {}

    # ---- Command handling --------------------------------------------------

    def handle_text(self, node_id: str, text: str) -> str:
        """Run one PAD command for a mesh node and return the full response."""
        try:
            parsed = radio_pad.parse_command(text)
        except ValueError:
            return "OMNIDAT FIELD PAD\nERR EMPTY COMMAND\nCLR ERR C:19 D:0"
        verb = parsed["verb"]
        args = parsed["args"]

        try:
            if verb == "HELP":
                return self.render_help()
            if verb == "MSG":
                return self.run_msg(node_id, args)
            if verb == "MAIL":
                return self.run_mail(node_id)
            if verb == "SENT":
                if not args:
                    raise ValueError("usage: SENT <RCPT>")
                return format_delivery(self.bridge.receipt(args[0]))
            if verb == "POST":
                return self.run_post(node_id, args)
            if verb == "CALL" and args:
                board_service = find_board_service(self.packet_services, args[0])
                if board_service is not None:
                    return self.run_board_read(node_id, board_service, args[1:])
            return radio_pad.handle_command(
                text,
                data_dir=self.data_dir,
                log_path=self.log_path,
            )
        except ClearedError as cleared:
            return cleared.clr_line
        except ValueError as error:
            return f"OMNIDAT FIELD PAD\nERR {error}\nCLR ERR C:19 D:0"

    def respond(self, node_id: str, text: str) -> list[str]:
        """handle_text, framed for the mesh."""
        return chunk_for_mesh(self.handle_text(node_id, text), limit=self.mesh_limit)

    def run_msg(self, node_id: str, args: list[str]) -> str:
        if len(args) < 2:
            raise ValueError("usage: MSG <ADDR> <TEXT>")
        session, account = self.open_session(node_id)
        _, output = message_send(
            session,
            account,
            args[0],
            " ".join(args[1:]),
            self.bridge,
            self.packet_namespaces,
            log_path=self.log_path,
        )
        return output

    def run_mail(self, node_id: str) -> str:
        session, account = self.open_session(node_id)
        _, output = message_mail(session, account, self.bridge, log_path=self.log_path)
        return output

    def run_post(self, node_id: str, args: list[str]) -> str:
        if len(args) < 2:
            raise ValueError("usage: POST <BOARD> [NAME#TRIP] <TEXT>")
        service = find_board_service(self.packet_services, args[0])
        if service is None:
            raise ClearedError("NP", 13, 0, f"no such board {args[0]}")
        body_args = args[1:]
        name: str | None = None
        # PAD tripcode grammar (design doc): `POST /GEN/ Froody#hunter2 GOT ONE`
        # — a poster name is the first body token containing a `#`.
        if len(body_args) >= 2 and "#" in body_args[0] and not body_args[0].startswith("#"):
            name = body_args[0]
            body_args = body_args[1:]
        session, account = self.open_session(node_id)
        _, output = board_post(
            session,
            account,
            service,
            " ".join(body_args),
            self.bridge,
            name=name,
            log_path=self.log_path,
        )
        return output

    def run_board_read(
        self,
        node_id: str,
        service: dict[str, Any],
        args: list[str],
    ) -> str:
        after = int(args[0]) if args and args[0].isdigit() else None
        session, account = self.open_session(node_id)
        _, output = board_read(
            session,
            account,
            service,
            self.bridge,
            after=after,
            log_path=self.log_path,
        )
        return output

    def render_help(self) -> str:
        return "\n".join([radio_pad.render_help(), *MESH_HELP_EXTRA])

    def open_session(self, node_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
        account_id = self.nodes.get(node_id, GUEST_ACCOUNT_ID)
        account = self.accounts.get(account_id) or self.accounts[GUEST_ACCOUNT_ID]
        session = start_session(f"MESH-{node_id}", account["account_id"])
        # The wired PAD stamps `transport: pad` into gated-board ctx; the
        # mesh edge must identify itself so the audit trail stays honest.
        session["transport"] = "mesh"
        return session, account

    # ---- Radio PAD push ("N NEW MSG") ---------------------------------------

    def poll_notifications(self, send: Callable[[str, str], None]) -> None:
        """Push terse new-mail notices to registered subscriber nodes.

        Reads mailboxes WITHOUT advancing read markers; a node is pinged when
        its unread count changes to a new non-zero value, once per value, so
        an unfetched mailbox is not re-announced every poll.
        """
        for node_id, account_id in self.nodes.items():
            account = self.accounts.get(account_id)
            if not account:
                continue
            addr = account.get("subscriber_address")
            if not addr or account.get("status") != "active":
                continue
            try:
                count = len(self.bridge.mailbox(addr))
            except ClearedError:
                continue  # bridge outage: stay quiet, try next poll
            if count and count != self._notified_counts.get(addr):
                send(node_id, f"OMNIDAT {count} NEW MSG  SEND MAIL TO READ")
            self._notified_counts[addr] = count


# ---- Runtime transports -----------------------------------------------------


def run_radio(gateway: MeshGateway, args: argparse.Namespace) -> int:
    """Attach to a real Meshtastic node and serve direct messages."""
    try:
        from pubsub import pub  # type: ignore[import-not-found]

        if args.tcp:
            import meshtastic.tcp_interface  # type: ignore[import-not-found]

            interface = meshtastic.tcp_interface.TCPInterface(hostname=args.tcp)
        else:
            import meshtastic.serial_interface  # type: ignore[import-not-found]

            interface = meshtastic.serial_interface.SerialInterface(devPath=args.serial)
    except ImportError as error:
        print(
            "meshtastic radio support requires the 'meshtastic' package:\n"
            "  python3 -m pip install meshtastic\n"
            f"({error})",
            file=sys.stderr,
        )
        return 2

    my_id = (interface.getMyUser() or {}).get("id")
    print(f"OMNIDAT mesh gateway up as {my_id}; bridge {gateway.bridge.base_url}")

    def on_text(packet: dict[str, Any], interface: Any) -> None:  # noqa: ANN401
        text = (packet.get("decoded") or {}).get("text")
        sender = packet.get("fromId")
        # Direct messages only: never answer (or echo into) a shared channel.
        if not text or not sender or packet.get("toId") != my_id:
            return
        for frame in gateway.respond(sender, text):
            interface.sendText(frame, destinationId=sender, wantAck=True)

    pub.subscribe(on_text, "meshtastic.receive.text")

    def notify_send(node_id: str, text: str) -> None:
        interface.sendText(text, destinationId=node_id, wantAck=True)

    try:
        while True:
            if args.notify_interval > 0:
                gateway.poll_notifications(notify_send)
            time.sleep(args.notify_interval if args.notify_interval > 0 else 60)
    except KeyboardInterrupt:
        interface.close()
        return 0


def run_simulator(gateway: MeshGateway, node_id: str) -> int:
    """Drive the gateway from stdin as a fake mesh node (no radio needed)."""
    print(f"OMNIDAT mesh gateway simulator; you are {node_id}. CTRL-D exits.")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        for frame in gateway.respond(node_id, line):
            print(frame)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="OMNIDAT Meshtastic gateway: mesh direct messages in, PAD services out.",
    )
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    parser.add_argument("--bridge-url", default=os.environ.get("OMNIDAT_BRIDGE_URL"))
    parser.add_argument("--bridge-secret", default=os.environ.get("OMNIDAT_BRIDGE_SECRET"))
    parser.add_argument("--serial", default=None, help="serial device path (default: auto-detect)")
    parser.add_argument("--tcp", default=None, help="Meshtastic node TCP host instead of serial")
    parser.add_argument("--simulate", action="store_true", help="stdin/stdout fake node, no radio")
    parser.add_argument("--simulate-node", default="!e2e30001", help="node id to simulate as")
    parser.add_argument(
        "--notify-interval",
        default=0,
        type=int,
        help="seconds between new-mail push polls (0 disables)",
    )
    args = parser.parse_args()

    gateway = MeshGateway(
        data_dir=args.data_dir,
        bridge=MatrixBridge(base_url=args.bridge_url, secret=args.bridge_secret),
        log_path=args.log,
    )
    if args.simulate:
        return run_simulator(gateway, args.simulate_node)
    return run_radio(gateway, args)


if __name__ == "__main__":
    raise SystemExit(main())
