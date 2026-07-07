from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from tools.omnidat_events import read_events, summarize_events


def collect_status(
    data_dir: Path,
    event_log: Path,
    media_state_path: Path,
    spool_dir: Path,
    fax_dir: Path,
) -> dict[str, Any]:
    services = load_json(data_dir / "services.json") if (data_dir / "services.json").exists() else []
    events = read_events(event_log)
    summary = summarize_events(events)
    media_state = load_json(media_state_path) if media_state_path.exists() else {}
    print_jobs = list(spool_dir.glob("*/*.txt")) if spool_dir.exists() else []
    faxes = list(fax_dir.glob("*.json")) if fax_dir.exists() else []

    return {
        "services": len(services),
        **summary,
        "media_state": media_state.get("state", "UNKNOWN"),
        "active_media_request": media_state.get("active_request_id"),
        "print_jobs": len(print_jobs),
        "faxes": len(faxes),
    }


def render_status(status: dict[str, Any]) -> str:
    active_request = status.get("active_media_request") or "NONE"
    lines = [
        "OMNIDAT OPERATOR STATUS",
        "THE RECORD IS TOTAL",
        "EXCHANGE 88",
        "",
        f"SERVICES: {status.get('services', 0)}",
        f"MEDIA VAULT: {status.get('media_state', 'UNKNOWN')}",
        f"ACTIVE MEDIA REQUEST: {active_request}",
        "",
        f"CALLS COMPLETED: {status.get('calls_completed', 0)}",
        f"BUSY/INTERCEPTS: {status.get('busy_or_intercepts', 0)}",
        f"PAD SESSIONS: {status.get('pad_sessions', 0)}",
        f"BBS SESSIONS: {status.get('bbs_sessions', 0)}",
        f"FAXES RECEIVED: {status.get('faxes_received', 0)}",
        f"PRINT JOBS: {status.get('print_jobs', 0)}",
        f"FAX RECORDS: {status.get('faxes', 0)}",
        f"MEDIA REQUESTS: {status.get('media_requests', 0)}",
        f"INCIDENTS: {status.get('incidents', 0)}",
        "",
        "# THE RECORD IS TOTAL. ASSIMILATION IS INEVITABLE. COMPLIANCE IS OBSERVED. THE LEDGER COMPELS.",
    ]
    return "\n".join(lines)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def main() -> int:
    parser = argparse.ArgumentParser(description="Render OMNIDAT operator status.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--events", default="build/events.jsonl", type=Path)
    parser.add_argument("--media-state", default="build/media-vault-state.json", type=Path)
    parser.add_argument("--spool-dir", default="build/spool", type=Path)
    parser.add_argument("--fax-dir", default="build/fax", type=Path)
    args = parser.parse_args()

    print(
        render_status(
            collect_status(
                args.data_dir,
                args.events,
                args.media_state,
                args.spool_dir,
                args.fax_dir,
            )
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
