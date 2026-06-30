from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable


ASTERISK_CONTEXTS = {
    "operator": "omnidat-operator",
    "ivr": "omnidat-ivr",
    "hunt": "omnidat-hunt",
    "direct": "omnidat-direct",
    "service": "omnidat-apps",
}


def load_json(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


def render_service_directory(services: Iterable[dict]) -> str:
    lines = [
        "OMNIDAT EXCHANGE 88 SERVICE DIRECTORY",
        "A GMACKO CORPORATION",
        "",
        "NUMBER  SERVICE                         DESCRIPTION",
        "------  ------------------------------  ------------------------------",
    ]

    for service in sorted(services, key=lambda item: item["number"]):
        lines.append(
            f"{service['number']}  "
            f"{service['name'][:30]:<30}  "
            f"{service.get('description', '')}"
        )

    lines.append("")
    return "\n".join(lines)


def render_packet_directory(packet_services: Iterable[dict]) -> str:
    lines = [
        "OMNIDAT PACKET CLEARING DIRECTORY",
        "AUTHORIZED TERMINAL SERVICE",
        "",
        "ADDRESS  ACCESS      SERVICE",
        "-------  ----------  ------------------------------",
    ]

    for service in sorted(packet_services, key=lambda item: item["address"]):
        lines.append(
            f"PAD> CALL {service['address']}  "
            f"{service.get('access_class', ''):<10}  "
            f"{service['name']}"
        )

    lines.append("")
    return "\n".join(lines)


def render_asterisk_routes(services: Iterable[dict]) -> str:
    lines = [
        "; Generated OMNIDAT Exchange 88 route map.",
        "; Review before copying into a live PBX.",
        "",
        "[omnidat-inbound-generated]",
    ]

    for service in sorted(services, key=lambda item: item["number"]):
        context = ASTERISK_CONTEXTS.get(service.get("route_class"), "omnidat-intercept")
        lines.append(
            f"exten => {service['number']},1,"
            f"Goto({context},{service['service_id']},1)"
        )

    lines.append("exten => _88XX,1,Goto(omnidat-intercept,unassigned,1)")
    lines.append("")
    return "\n".join(lines)


def render_all(data_dir: Path, output_dir: Path) -> list[Path]:
    services = load_json(data_dir / "services.json")
    packet_services = load_json(data_dir / "packet-services.json")
    output_dir.mkdir(parents=True, exist_ok=True)

    artifacts = {
        "service-directory.txt": render_service_directory(services),
        "packet-directory.txt": render_packet_directory(packet_services),
        "asterisk-routes.conf": render_asterisk_routes(services),
    }

    written = []
    for name, content in artifacts.items():
        path = output_dir / name
        path.write_text(content)
        written.append(path)

    return written


def main() -> int:
    parser = argparse.ArgumentParser(description="Render OMNIDAT data artifacts.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--output-dir", default="build/artifacts", type=Path)
    args = parser.parse_args()

    for path in render_all(args.data_dir, args.output_dir):
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
