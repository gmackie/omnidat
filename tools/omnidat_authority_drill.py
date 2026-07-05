from __future__ import annotations

import argparse
import json
import os
from typing import Any, Callable
from urllib.request import Request, urlopen


Transport = Callable[[Request], Any]


def _call(
    transport: Transport,
    base_url: str,
    token: str,
    procedure: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    request = Request(
        f"{base_url.rstrip('/')}/api/trpc/{procedure}",
        data=json.dumps({"json": payload}).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with transport(request) as response:
        decoded = json.loads(response.read().decode("utf-8"))
    return decoded["result"]["data"]["json"]


def run_authority_drill(
    base_url: str,
    token: str,
    event_id: str,
    field_source_id: str,
    operator_id: str,
    transport: Transport | None = None,
) -> dict[str, Any]:
    """Drive an authority failover in both directions against a live target.

    `token` is a NOC operator API key (``gmk_...``); authority transfer is
    gated on the operator's authority.transfer capability, and the acting
    operator is derived from the session the key resolves to.

    Field -> cloud, then cloud -> field, each an epoch-incrementing transfer.
    Returns a pass/fail transcript suitable for printing as rehearsal evidence.
    """
    transport = transport or urlopen
    steps: list[dict[str, Any]] = []

    def transfer(direction: str, to_holder: str, to_source: str, reason: str) -> dict[str, Any]:
        status = _call(
            transport, base_url, token, "omnidat.authorityStatus", {"eventId": event_id}
        )
        watermarks = {
            source["sourceId"]: source.get("lastPushedSeq", 0)
            for source in status.get("sources", [])
        }
        result = _call(
            transport,
            base_url,
            token,
            "omnidat.transferAuthority",
            {
                "eventId": event_id,
                "toHolder": to_holder,
                "toSourceId": to_source,
                "reason": reason,
                "targetWatermarks": watermarks,
            },
        )
        step = {
            "direction": direction,
            "holder": result["holder"],
            "epoch": result["epoch"],
            "fenceSeq": result.get("fenceSeq"),
            "ok": result["holder"] == to_holder,
        }
        steps.append(step)
        return step

    try:
        transfer("field-to-cloud", "cloud", "cloud", "field kit unreachable (drill)")
        transfer("cloud-to-field", "field", field_source_id, "field kit recovered (drill)")
        status = "pass" if all(step["ok"] for step in steps) else "fail"
        error = None
    except Exception as failure:  # noqa: BLE001 - drill records any failure
        status = "fail"
        error = str(failure)

    return {
        "status": status,
        "event_id": event_id,
        "steps": steps,
        "error": error,
        "transcript": render_transcript(event_id, steps, status, error),
    }


def render_transcript(
    event_id: str,
    steps: list[dict[str, Any]],
    status: str,
    error: str | None,
) -> str:
    lines = [
        "OMNIDAT AUTHORITY FAILOVER DRILL",
        "A GMACKO CORPORATION",
        "EXCHANGE 88",
        "",
        f"EVENT: {event_id}",
        "",
    ]
    for step in steps:
        lines.append(
            f"{step['direction'].upper()}: HOLDER {step['holder'].upper()} "
            f"EPOCH {step['epoch']} FENCE {step['fenceSeq']} "
            f"{'OK' if step['ok'] else 'FAIL'}"
        )
    if error:
        lines.append(f"ERROR: {error}")
    lines.append("")
    lines.append(f"RESULT: {status.upper()}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Drive an OMNIDAT authority failover drill in both directions."
    )
    parser.add_argument("--target", default=os.environ.get("OMNIDAT_SYNC_TARGET"))
    parser.add_argument(
        "--token",
        default=os.environ.get("OMNIDAT_OPERATOR_TOKEN"),
        help="NOC operator API key (gmk_...) with the authority.transfer capability",
    )
    parser.add_argument("--event-id", required=True)
    parser.add_argument("--field-source-id", default="field-kit-01")
    parser.add_argument(
        "--operator-id",
        default="noc-operator",
        help="label for the transcript; the acting operator is the API key's user",
    )
    args = parser.parse_args()

    if not args.target or not args.token:
        parser.error("set --target/--token or OMNIDAT_SYNC_TARGET/OMNIDAT_OPERATOR_TOKEN")

    result = run_authority_drill(
        base_url=args.target,
        token=args.token,
        event_id=args.event_id,
        field_source_id=args.field_source_id,
        operator_id=args.operator_id,
    )
    print(result["transcript"])
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
