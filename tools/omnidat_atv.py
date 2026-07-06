from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


TELETEXT_COLUMNS = 40
TELETEXT_ROWS = 24


def load_stations(path: Path) -> dict[str, dict[str, Any]]:
    stations = json.loads(path.read_text())
    return {station["station_id"]: station for station in stations}


def render_teletext_page(station: dict[str, Any], page_number: str) -> str:
    pages = station.get("teletext", {}).get("pages", {})
    if page_number not in pages:
        raise KeyError(f"unknown teletext page {page_number}")

    page = pages[page_number]
    service_name = station.get("teletext", {}).get("service_name", "TELETEXT")
    header = f"{service_name} {page_number} {page['title']}"
    body = [
        header,
        f"STATION {station['station_id']}",
        "",
        *page.get("lines", []),
    ]
    padded = [_format_line(line) for line in body[:TELETEXT_ROWS]]
    while len(padded) < TELETEXT_ROWS:
        padded.append(" " * TELETEXT_COLUMNS)
    return "\n".join(padded)


def export_station_pages(
    station_path: Path,
    output_dir: Path,
    station_id: str,
) -> list[Path]:
    stations = load_stations(station_path)
    station = stations[station_id]
    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for page_number in sorted(station.get("teletext", {}).get("pages", {})):
        path = output_dir / f"{station_id}-{page_number}.txt"
        path.write_text(render_teletext_page(station, page_number) + "\n")
        written.append(path)
    return written


def _format_line(value: str) -> str:
    return value[:TELETEXT_COLUMNS].ljust(TELETEXT_COLUMNS)


def main() -> int:
    parser = argparse.ArgumentParser(description="Render OMNIDAT ATV Teletext pages.")
    parser.add_argument("--stations", default="data/atv-stations.sample.json", type=Path)
    subparsers = parser.add_subparsers(dest="command", required=True)

    render_parser = subparsers.add_parser("render")
    render_parser.add_argument("station_id")
    render_parser.add_argument("page")

    export_parser = subparsers.add_parser("export")
    export_parser.add_argument("station_id")
    export_parser.add_argument("--output", default="build/atv-teletext", type=Path)

    args = parser.parse_args()
    if args.command == "render":
        stations = load_stations(args.stations)
        print(render_teletext_page(stations[args.station_id], args.page))
        return 0

    written = export_station_pages(args.stations, args.output, args.station_id)
    for path in written:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
