from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from tools.omnidat_events import append_event


KNOWN_QUEUES = {"forms", "receipts", "logs", "vault", "settlement"}


def spool_print_job(
    spool_dir: Path,
    queue: str,
    title: str,
    body: str,
    source: str,
    log_path: Path | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    if queue not in KNOWN_QUEUES:
        raise ValueError(f"unknown queue {queue}")

    queue_dir = spool_dir / queue
    queue_dir.mkdir(parents=True, exist_ok=True)
    print_job_id = next_id(queue_dir, "PRINT")
    created_at = created_at or now()
    path = queue_dir / f"{print_job_id}.txt"
    content = render_print_job(print_job_id, queue, title, body, source, created_at)
    path.write_text(content)
    job = {
        "print_job_id": print_job_id,
        "queue": queue,
        "title": title,
        "source": source,
        "status": "spooled",
        "created_at": created_at,
        "path": str(path),
    }
    emit(log_path, "print.printed", job, created_at=created_at)
    return job


def receive_fax(
    fax_dir: Path,
    pages: int,
    number: str,
    caller: str,
    operator_initials: str | None = None,
    log_path: Path | None = None,
    received_at: str | None = None,
) -> dict[str, Any]:
    fax_dir.mkdir(parents=True, exist_ok=True)
    fax_id = next_id(fax_dir, "FAX")
    received_at = received_at or now()
    path = fax_dir / f"{fax_id}.json"
    record = {
        "fax_id": fax_id,
        "direction": "inbound",
        "number": number,
        "caller": caller,
        "status": "received",
        "pages": pages,
        "received_at": received_at,
        "operator_initials": operator_initials,
        "path": str(path),
    }
    path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n")
    emit(log_path, "fax.received", record, created_at=received_at)
    return record


def list_spool(spool_dir: Path, fax_dir: Path) -> str:
    print_jobs = sorted(spool_dir.glob("*/*.txt")) if spool_dir.exists() else []
    faxes = sorted(fax_dir.glob("*.json")) if fax_dir.exists() else []
    lines = [
        "OMNIDAT DOCUMENT SERVICES QUEUE",
        "A GMACKO CORPORATION",
        "",
        f"PRINT JOBS: {len(print_jobs)}",
    ]
    lines.extend(f"  {path.stem}  {path.parent.name}" for path in print_jobs)
    lines.append(f"FAXES: {len(faxes)}")
    lines.extend(f"  {path.stem}" for path in faxes)
    lines.append("")
    return "\n".join(lines)


def render_print_job(
    print_job_id: str,
    queue: str,
    title: str,
    body: str,
    source: str,
    created_at: str,
) -> str:
    return "\n".join(
        [
            "OMNIDAT DOCUMENT SERVICES",
            "A GMACKO CORPORATION",
            f"PRINT JOB: {print_job_id}",
            f"QUEUE: {queue}",
            f"SOURCE: {source}",
            f"CREATED: {created_at}",
            "",
            title,
            "-" * min(max(len(title), 1), 60),
            body,
            "",
        ]
    )


def next_id(directory: Path, prefix: str) -> str:
    existing = sorted(directory.glob(f"{prefix}-*.txt" if prefix == "PRINT" else f"{prefix}-*.json"))
    return f"{prefix}-{len(existing) + 1:06d}"


def emit(
    log_path: Path | None,
    event_type: str,
    payload: dict[str, Any],
    created_at: str | None = None,
) -> None:
    if log_path is not None:
        append_event(log_path, event_type, "document-services", payload, created_at=created_at)


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def main() -> int:
    parser = argparse.ArgumentParser(description="OMNIDAT Document Services spooler.")
    parser.add_argument("--spool-dir", default="build/spool", type=Path)
    parser.add_argument("--fax-dir", default="build/fax", type=Path)
    parser.add_argument("--log", default="build/events.jsonl", type=Path)
    subparsers = parser.add_subparsers(dest="command", required=True)

    print_parser = subparsers.add_parser("print")
    print_parser.add_argument("queue")
    print_parser.add_argument("title")
    print_parser.add_argument("--body", default="")
    print_parser.add_argument("--source", default="operator")

    fax_parser = subparsers.add_parser("fax")
    fax_parser.add_argument("--pages", type=int, required=True)
    fax_parser.add_argument("--number", default="8818")
    fax_parser.add_argument("--caller", default="UNKNOWN")
    fax_parser.add_argument("--operator")

    subparsers.add_parser("list")

    args = parser.parse_args()
    if args.command == "print":
        result = spool_print_job(
            args.spool_dir,
            args.queue,
            args.title,
            args.body,
            args.source,
            log_path=args.log,
        )
        print(json.dumps(result, indent=2, sort_keys=True))
    elif args.command == "fax":
        result = receive_fax(
            args.fax_dir,
            args.pages,
            args.number,
            args.caller,
            operator_initials=args.operator,
            log_path=args.log,
        )
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print(list_spool(args.spool_dir, args.fax_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
