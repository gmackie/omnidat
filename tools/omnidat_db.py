from __future__ import annotations

import argparse
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any


TABLES = [
    "services",
    "endpoints",
    "service_endpoints",
    "packet_services",
    "packet_namespaces",
    "transport_profiles",
    "campsite_apps",
    "campsite_app_transports",
    "accounts",
    "account_packet_permissions",
    "vendors",
    "terminals",
    "carrier_circuits",
    "media_tapes",
    "atv_stations",
    "atv_teletext_pages",
    "print_queues",
]


def load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text())


def build_database(data_dir: Path, db_path: Path) -> None:
    if db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with closing(sqlite3.connect(db_path)) as connection:
        connection.execute("pragma foreign_keys = on")
        create_schema(connection)
        load_seed_data(connection, data_dir)
        connection.commit()


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        create table services (
          service_id text primary key,
          number text not null unique,
          name text not null,
          route_class text not null,
          owner text,
          description text,
          channel_limit integer,
          maintenance_mode integer not null default 0
        );

        create table endpoints (
          endpoint_id text primary key,
          kind text not null,
          number text,
          status text,
          hardware text,
          notes text
        );

        create table service_endpoints (
          service_id text not null references services(service_id),
          endpoint_id text not null,
          position integer not null,
          primary key (service_id, endpoint_id)
        );

        create table packet_services (
          address text primary key,
          name text not null,
          access_class text not null,
          description text
        );

        create table packet_namespaces (
          namespace_id text primary key,
          range_start text not null,
          range_end text not null,
          label text not null,
          service_class text not null,
          provisioning text not null,
          directory_status text not null,
          description text,
          unique (range_start, range_end),
          check (range_start <= range_end)
        );

        create table transport_profiles (
          transport_id text primary key,
          name text not null,
          kind text not null,
          authority text not null,
          default_access text not null,
          description text
        );

        create table campsite_apps (
          address text primary key,
          owner_name text not null,
          app_name text not null,
          template text not null,
          access_class text not null,
          directory_status text not null,
          status text not null,
          description text
        );

        create table campsite_app_transports (
          address text not null references campsite_apps(address),
          transport_id text not null references transport_profiles(transport_id),
          primary key (address, transport_id)
        );

        create table accounts (
          account_id text primary key,
          display_name text not null,
          access_class text not null,
          status text not null
        );

        create table account_packet_permissions (
          account_id text not null references accounts(account_id),
          permission text not null,
          primary key (account_id, permission)
        );

        create table vendors (
          vendor_id text primary key,
          name text not null,
          kind text not null,
          contact_number text,
          status text not null
        );

        create table terminals (
          terminal_id text primary key,
          vendor_id text not null references vendors(vendor_id),
          kind text not null,
          trust_mode text not null,
          location text,
          account_id text references accounts(account_id),
          status text not null
        );

        create table carrier_circuits (
          circuit_id text primary key,
          vendor_id text not null references vendors(vendor_id),
          terminal_id text not null references terminals(terminal_id),
          service_address text not null references packet_services(address),
          access_class text not null,
          status text not null
        );

        create table media_tapes (
          tape_id text primary key,
          title text not null,
          slot integer not null unique,
          runtime_minutes integer,
          rights text,
          status text not null
        );

        create table atv_stations (
          station_id text primary key,
          name text not null,
          kind text not null,
          control_operator_role text not null,
          packet_address text not null references packet_services(address),
          dial_service text not null references services(number),
          callsign text,
          rf_mode text,
          frequency text,
          service_name text not null,
          teletext_system text,
          teletext_encoding text,
          video_chain_json text not null
        );

        create table atv_teletext_pages (
          station_id text not null references atv_stations(station_id),
          page_number text not null,
          title text not null,
          lines_json text not null,
          primary key (station_id, page_number)
        );

        create table print_queues (
          queue text primary key,
          description text,
          operator_visible integer not null default 0
        );
        """
    )


def load_seed_data(connection: sqlite3.Connection, data_dir: Path) -> None:
    services = load_json(data_dir / "services.json")
    endpoints = load_json(data_dir / "endpoints.json")
    packet_services = load_json(data_dir / "packet-services.json")
    packet_namespaces = load_json(data_dir / "packet-namespaces.sample.json")
    transport_profiles = load_json(data_dir / "transport-profiles.sample.json")
    campsite_apps = load_json(data_dir / "campsite-apps.sample.json")
    accounts = load_json(data_dir / "accounts.sample.json")
    vendors = load_json(data_dir / "vendors.sample.json")
    terminals = load_json(data_dir / "terminals.sample.json")
    carrier_circuits = load_json(data_dir / "carrier-circuits.sample.json")
    media_tapes = load_json(data_dir / "media-catalog.sample.json")
    atv_stations = load_json(data_dir / "atv-stations.sample.json")
    print_queues = load_json(data_dir / "print-queues.json")

    for service in services:
        connection.execute(
            """
            insert into services (
              service_id, number, name, route_class, owner, description,
              channel_limit, maintenance_mode
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                service["service_id"],
                service["number"],
                service["name"],
                service["route_class"],
                service.get("owner"),
                service.get("description"),
                service.get("channel_limit"),
                int(bool(service.get("maintenance_mode", False))),
            ),
        )
        for position, endpoint_id in enumerate(service.get("endpoints", [])):
            connection.execute(
                """
                insert into service_endpoints (service_id, endpoint_id, position)
                values (?, ?, ?)
                """,
                (service["service_id"], endpoint_id, position),
            )

    for endpoint in endpoints:
        connection.execute(
            """
            insert into endpoints (endpoint_id, kind, number, status, hardware, notes)
            values (?, ?, ?, ?, ?, ?)
            """,
            (
                endpoint["endpoint_id"],
                endpoint["kind"],
                endpoint.get("number"),
                endpoint.get("status"),
                endpoint.get("hardware"),
                endpoint.get("notes"),
            ),
        )

    for packet_service in packet_services:
        connection.execute(
            """
            insert into packet_services (address, name, access_class, description)
            values (?, ?, ?, ?)
            """,
            (
                packet_service["address"],
                packet_service["name"],
                packet_service["access_class"],
                packet_service.get("description"),
            ),
        )

    for namespace in packet_namespaces:
        connection.execute(
            """
            insert into packet_namespaces (
              namespace_id, range_start, range_end, label, service_class,
              provisioning, directory_status, description
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                namespace["namespace_id"],
                namespace["range_start"],
                namespace["range_end"],
                namespace["label"],
                namespace["service_class"],
                namespace["provisioning"],
                namespace["directory_status"],
                namespace.get("description"),
            ),
        )

    for transport in transport_profiles:
        connection.execute(
            """
            insert into transport_profiles (
              transport_id, name, kind, authority, default_access, description
            ) values (?, ?, ?, ?, ?, ?)
            """,
            (
                transport["transport_id"],
                transport["name"],
                transport["kind"],
                transport["authority"],
                transport["default_access"],
                transport.get("description"),
            ),
        )

    for app in campsite_apps:
        connection.execute(
            """
            insert into campsite_apps (
              address, owner_name, app_name, template, access_class,
              directory_status, status, description
            ) values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                app["address"],
                app["owner_name"],
                app["app_name"],
                app["template"],
                app["access_class"],
                app["directory_status"],
                app["status"],
                app.get("description"),
            ),
        )
        for transport_id in app.get("transports", []):
            connection.execute(
                """
                insert into campsite_app_transports (address, transport_id)
                values (?, ?)
                """,
                (app["address"], transport_id),
            )

    for account in accounts:
        connection.execute(
            """
            insert into accounts (account_id, display_name, access_class, status)
            values (?, ?, ?, ?)
            """,
            (
                account["account_id"],
                account["display_name"],
                account["access_class"],
                account["status"],
            ),
        )
        for permission in account.get("packet_permissions", []):
            connection.execute(
                """
                insert into account_packet_permissions (account_id, permission)
                values (?, ?)
                """,
                (account["account_id"], permission),
            )

    for vendor in vendors:
        connection.execute(
            """
            insert into vendors (vendor_id, name, kind, contact_number, status)
            values (?, ?, ?, ?, ?)
            """,
            (
                vendor["vendor_id"],
                vendor["name"],
                vendor["kind"],
                vendor.get("contact_number"),
                vendor["status"],
            ),
        )

    for terminal in terminals:
        connection.execute(
            """
            insert into terminals (
              terminal_id, vendor_id, kind, trust_mode, location, account_id, status
            ) values (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                terminal["terminal_id"],
                terminal["vendor_id"],
                terminal["kind"],
                terminal["trust_mode"],
                terminal.get("location"),
                terminal.get("account_id"),
                terminal["status"],
            ),
        )

    for circuit in carrier_circuits:
        connection.execute(
            """
            insert into carrier_circuits (
              circuit_id, vendor_id, terminal_id, service_address, access_class, status
            ) values (?, ?, ?, ?, ?, ?)
            """,
            (
                circuit["circuit_id"],
                circuit["vendor_id"],
                circuit["terminal_id"],
                circuit["service_address"],
                circuit["access_class"],
                circuit["status"],
            ),
        )

    for tape in media_tapes:
        connection.execute(
            """
            insert into media_tapes (
              tape_id, title, slot, runtime_minutes, rights, status
            ) values (?, ?, ?, ?, ?, ?)
            """,
            (
                tape["tape_id"],
                tape["title"],
                tape["slot"],
                tape.get("runtime_minutes"),
                tape.get("rights"),
                tape["status"],
            ),
        )

    for station in atv_stations:
        teletext = station.get("teletext", {})
        connection.execute(
            """
            insert into atv_stations (
              station_id, name, kind, control_operator_role, packet_address,
              dial_service, callsign, rf_mode, frequency, service_name,
              teletext_system, teletext_encoding, video_chain_json
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                station["station_id"],
                station["name"],
                station["kind"],
                station["control_operator_role"],
                station["packet_address"],
                station["dial_service"],
                station.get("callsign"),
                station.get("rf_mode"),
                station.get("frequency"),
                teletext["service_name"],
                teletext.get("system"),
                teletext.get("encoding"),
                json.dumps(station.get("video_chain", []), sort_keys=True),
            ),
        )
        for page_number, page in sorted(teletext.get("pages", {}).items()):
            connection.execute(
                """
                insert into atv_teletext_pages (
                  station_id, page_number, title, lines_json
                ) values (?, ?, ?, ?)
                """,
                (
                    station["station_id"],
                    page_number,
                    page["title"],
                    json.dumps(page.get("lines", []), sort_keys=True),
                ),
            )

    for queue in print_queues:
        connection.execute(
            """
            insert into print_queues (queue, description, operator_visible)
            values (?, ?, ?)
            """,
            (
                queue["queue"],
                queue.get("description"),
                int(bool(queue.get("operator_visible", False))),
            ),
        )


def load_service_routes(db_path: Path) -> list[dict[str, str]]:
    with closing(sqlite3.connect(db_path)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            select
              services.number,
              services.name,
              services.route_class,
              group_concat(service_endpoints.endpoint_id, ',') as endpoints
            from services
            left join service_endpoints
              on service_endpoints.service_id = services.service_id
            group by services.service_id
            order by services.number
            """
        ).fetchall()

    return [
        {
            "number": row["number"],
            "name": row["name"],
            "route_class": row["route_class"],
            "endpoints": row["endpoints"] or "",
        }
        for row in rows
    ]


def summarize_database(db_path: Path) -> dict[str, int]:
    with closing(sqlite3.connect(db_path)) as connection:
        return {
            table: connection.execute(f"select count(*) from {table}").fetchone()[0]
            for table in TABLES
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build OMNIDAT SQLite database.")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--db-path", default="build/omnidat.db", type=Path)
    args = parser.parse_args()

    build_database(args.data_dir, args.db_path)
    print(args.db_path)
    for table, count in summarize_database(args.db_path).items():
        print(f"{table}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
