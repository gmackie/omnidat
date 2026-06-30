import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_db import build_database, load_service_routes, summarize_database


class DatabaseBuilderTests(unittest.TestCase):
    def test_build_database_loads_core_seed_tables(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            db_path = Path(temp_dir) / "omnidat.db"
            write_seed_data(data_dir)

            build_database(data_dir, db_path)

            with sqlite3.connect(db_path) as connection:
                service_count = connection.execute("select count(*) from services").fetchone()[0]
                endpoint_count = connection.execute("select count(*) from endpoints").fetchone()[0]
                packet_count = connection.execute("select count(*) from packet_services").fetchone()[0]
                namespace_count = connection.execute("select count(*) from packet_namespaces").fetchone()[0]
                transport_count = connection.execute("select count(*) from transport_profiles").fetchone()[0]
                campsite_app_count = connection.execute("select count(*) from campsite_apps").fetchone()[0]
                vendor_count = connection.execute("select count(*) from vendors").fetchone()[0]
                terminal_count = connection.execute("select count(*) from terminals").fetchone()[0]
                circuit_count = connection.execute("select count(*) from carrier_circuits").fetchone()[0]
                media_count = connection.execute("select count(*) from media_tapes").fetchone()[0]
                print_queue_count = connection.execute("select count(*) from print_queues").fetchone()[0]

            self.assertEqual(service_count, 2)
            self.assertEqual(endpoint_count, 2)
            self.assertEqual(packet_count, 3)
            self.assertEqual(namespace_count, 2)
            self.assertEqual(transport_count, 2)
            self.assertEqual(campsite_app_count, 2)
            self.assertEqual(vendor_count, 2)
            self.assertEqual(terminal_count, 2)
            self.assertEqual(circuit_count, 2)
            self.assertEqual(media_count, 1)
            self.assertEqual(print_queue_count, 1)

    def test_build_database_loads_packet_namespaces_and_transport_profiles(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            db_path = Path(temp_dir) / "omnidat.db"
            write_seed_data(data_dir)

            build_database(data_dir, db_path)

            with sqlite3.connect(db_path) as connection:
                namespaces = connection.execute(
                    """
                    select namespace_id, range_start, range_end, service_class, provisioning
                    from packet_namespaces
                    order by range_start
                    """
                ).fetchall()
                transports = connection.execute(
                    """
                    select transport_id, kind, authority, default_access
                    from transport_profiles
                    order by transport_id
                    """
                ).fetchall()

            self.assertEqual(
                namespaces,
                [
                    ("core", "000000", "000999", "CORE", "manual"),
                    ("open-campsite", "020000", "029999", "OPEN", "self-service"),
                ],
            )
            self.assertEqual(
                transports,
                [
                    ("hosted-node", "hosted", "service-host", "PUBLIC"),
                    ("meshcore-radio-pad", "radio-pad", "managed-field-access", "PASSPORT"),
                ],
            )

    def test_build_database_rejects_duplicate_packet_namespace_ranges(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            db_path = Path(temp_dir) / "omnidat.db"
            write_seed_data(data_dir)
            namespaces = json.loads((data_dir / "packet-namespaces.sample.json").read_text())
            duplicate = dict(namespaces[0])
            duplicate["namespace_id"] = "duplicate-core"
            namespaces.append(duplicate)
            (data_dir / "packet-namespaces.sample.json").write_text(json.dumps(namespaces))

            with self.assertRaises(sqlite3.IntegrityError):
                build_database(data_dir, db_path)

    def test_build_database_loads_campsite_apps_with_transport_assignments(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            db_path = Path(temp_dir) / "omnidat.db"
            write_seed_data(data_dir)

            build_database(data_dir, db_path)

            with sqlite3.connect(db_path) as connection:
                rows = connection.execute(
                    """
                    select address, owner_name, template, directory_status, status
                    from campsite_apps
                    order by address
                    """
                ).fetchall()
                transports = connection.execute(
                    """
                    select address, transport_id
                    from campsite_app_transports
                    order by address, transport_id
                    """
                ).fetchall()

            self.assertEqual(
                rows,
                [
                    ("020184", "Camp Laminar", "MESSAGE_DESK", "provisional", "active"),
                    ("020500", "Miliways", "QUEUE", "official", "active"),
                ],
            )
            self.assertEqual(
                transports,
                [
                    ("020184", "hosted-node"),
                    ("020184", "meshcore-radio-pad"),
                    ("020500", "hosted-node"),
                    ("020500", "meshcore-radio-pad"),
                ],
            )

    def test_build_database_links_carrier_circuits_to_terminal_inventory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            db_path = Path(temp_dir) / "omnidat.db"
            write_seed_data(data_dir)

            build_database(data_dir, db_path)

            with sqlite3.connect(db_path) as connection:
                rows = connection.execute(
                    """
                    select
                      carrier_circuits.circuit_id,
                      vendors.name,
                      terminals.kind,
                      packet_services.name
                    from carrier_circuits
                    join vendors on vendors.vendor_id = carrier_circuits.vendor_id
                    join terminals on terminals.terminal_id = carrier_circuits.terminal_id
                    join packet_services on packet_services.address = carrier_circuits.service_address
                    order by carrier_circuits.circuit_id
                    """
                ).fetchall()

            self.assertEqual(
                rows,
                [
                    ("CKT-NM-POS-01", "NiteMarkt", "pos-terminal", "SHADYBUCKS POS AUTHORIZATION"),
                    ("CKT-NM-WMS-01", "NiteMarkt", "boh-wms", "NITEMARKT BOH WMS"),
                ],
            )

    def test_load_service_routes_returns_ordered_route_view(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            db_path = Path(temp_dir) / "omnidat.db"
            write_seed_data(data_dir)
            build_database(data_dir, db_path)

            routes = load_service_routes(db_path)

            self.assertEqual(
                routes,
                [
                    {
                        "number": "8800",
                        "name": "OMNIDAT TrustDesk",
                        "route_class": "operator",
                        "endpoints": "OPERATOR-01",
                    },
                    {
                        "number": "8802",
                        "name": "OMNIDAT Online",
                        "route_class": "hunt",
                        "endpoints": "MODEM-01,MODEM-02",
                    },
                ],
            )

    def test_build_database_replaces_existing_output(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            db_path = Path(temp_dir) / "omnidat.db"
            write_seed_data(data_dir)
            db_path.write_text("stale")

            build_database(data_dir, db_path)

            with sqlite3.connect(db_path) as connection:
                self.assertEqual(connection.execute("select count(*) from services").fetchone()[0], 2)

    def test_summarize_database_reports_table_counts(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            db_path = Path(temp_dir) / "omnidat.db"
            write_seed_data(data_dir)
            build_database(data_dir, db_path)

            summary = summarize_database(db_path)

            self.assertEqual(summary["services"], 2)
            self.assertEqual(summary["endpoints"], 2)
            self.assertEqual(summary["packet_services"], 3)
            self.assertEqual(summary["packet_namespaces"], 2)
            self.assertEqual(summary["transport_profiles"], 2)
            self.assertEqual(summary["campsite_apps"], 2)
            self.assertEqual(summary["campsite_app_transports"], 4)
            self.assertEqual(summary["vendors"], 2)
            self.assertEqual(summary["terminals"], 2)
            self.assertEqual(summary["carrier_circuits"], 2)
            self.assertEqual(summary["media_tapes"], 1)


def write_seed_data(data_dir: Path) -> None:
    data_dir.mkdir()
    (data_dir / "services.json").write_text(
        json.dumps(
            [
                {
                    "service_id": "trustdesk",
                    "number": "8800",
                    "name": "OMNIDAT TrustDesk",
                    "route_class": "operator",
                    "owner": "PBX/operator",
                    "description": "Directory and human assistance",
                    "endpoints": ["OPERATOR-01"],
                    "channel_limit": 2,
                    "maintenance_mode": False,
                },
                {
                    "service_id": "omnidat-online",
                    "number": "8802",
                    "name": "OMNIDAT Online",
                    "route_class": "hunt",
                    "owner": "BBS/modem",
                    "description": "Main BBS hunt group",
                    "endpoints": ["MODEM-01", "MODEM-02"],
                    "channel_limit": 2,
                    "maintenance_mode": False,
                },
            ]
        )
    )
    (data_dir / "endpoints.json").write_text(
        json.dumps(
            [
                {"endpoint_id": "OPERATOR-01", "kind": "operator-phone", "status": "planned"},
                {"endpoint_id": "MODEM-01", "kind": "modem", "status": "planned"},
            ]
        )
    )
    (data_dir / "packet-services.json").write_text(
        json.dumps(
            [
                {
                    "address": "000001",
                    "name": "OMNIDAT DIRECTORY",
                    "access_class": "PUBLIC",
                    "description": "Packet service directory",
                },
                {
                    "address": "000011",
                    "name": "SHADYBUCKS POS AUTHORIZATION",
                    "access_class": "REGISTERED",
                    "description": "Trusted POS authorization path",
                },
                {
                    "address": "000020",
                    "name": "NITEMARKT BOH WMS",
                    "access_class": "REGISTERED",
                    "description": "NiteMarkt warehouse management system",
                }
            ]
        )
    )
    (data_dir / "packet-namespaces.sample.json").write_text(
        json.dumps(
            [
                {
                    "namespace_id": "core",
                    "range_start": "000000",
                    "range_end": "000999",
                    "label": "OMNIDAT core services",
                    "service_class": "CORE",
                    "provisioning": "manual",
                    "directory_status": "official",
                    "description": "Directory, accounts, operator messages, and internal expansion",
                },
                {
                    "namespace_id": "open-campsite",
                    "range_start": "020000",
                    "range_end": "029999",
                    "label": "Open campsite applications",
                    "service_class": "OPEN",
                    "provisioning": "self-service",
                    "directory_status": "provisional",
                    "description": "Self-service campsite applications",
                },
            ]
        )
    )
    (data_dir / "transport-profiles.sample.json").write_text(
        json.dumps(
            [
                {
                    "transport_id": "meshcore-radio-pad",
                    "name": "MeshCore Radio PAD",
                    "kind": "radio-pad",
                    "authority": "managed-field-access",
                    "default_access": "PASSPORT",
                    "description": "Managed OMNIDAT radio access",
                },
                {
                    "transport_id": "hosted-node",
                    "name": "OMNIDAT Hosted Node",
                    "kind": "hosted",
                    "authority": "service-host",
                    "default_access": "PUBLIC",
                    "description": "OMNIDAT-hosted campsite app template",
                },
            ]
        )
    )
    (data_dir / "campsite-apps.sample.json").write_text(
        json.dumps(
            [
                {
                    "address": "020184",
                    "owner_name": "Camp Laminar",
                    "app_name": "Camp Laminar Message Desk",
                    "template": "MESSAGE_DESK",
                    "access_class": "PUBLIC",
                    "directory_status": "provisional",
                    "status": "active",
                    "transports": ["hosted-node", "meshcore-radio-pad"],
                    "description": "Campsite message desk and lost-property contact",
                },
                {
                    "address": "020500",
                    "owner_name": "Miliways",
                    "app_name": "Miliways Order Entry",
                    "template": "QUEUE",
                    "access_class": "PUBLIC",
                    "directory_status": "official",
                    "status": "active",
                    "transports": ["hosted-node", "meshcore-radio-pad"],
                    "description": "Food order and line management queue",
                },
            ]
        )
    )
    (data_dir / "accounts.sample.json").write_text(
        json.dumps(
            [
                {
                    "account_id": "ACCT-GUEST",
                    "display_name": "PUBLIC GUEST",
                    "access_class": "PUBLIC",
                    "packet_permissions": ["DIRECTORY"],
                    "status": "active",
                }
            ]
        )
    )
    (data_dir / "vendors.sample.json").write_text(
        json.dumps(
            [
                {
                    "vendor_id": "VEND-NITEMARKT",
                    "name": "NiteMarkt",
                    "kind": "anchor-tenant",
                    "contact_number": "8819",
                    "status": "planned",
                },
                {
                    "vendor_id": "VEND-MISC-001",
                    "name": "Misc Vendor 001",
                    "kind": "vendor",
                    "contact_number": "8819",
                    "status": "planned",
                },
            ]
        )
    )
    (data_dir / "terminals.sample.json").write_text(
        json.dumps(
            [
                {
                    "terminal_id": "TERM-NM-POS-01",
                    "vendor_id": "VEND-NITEMARKT",
                    "kind": "pos-terminal",
                    "trust_mode": "directGateway",
                    "location": "NiteMarkt register 1",
                    "account_id": "ACCT-GUEST",
                    "status": "planned",
                },
                {
                    "terminal_id": "TERM-NM-BOH-01",
                    "vendor_id": "VEND-NITEMARKT",
                    "kind": "boh-wms",
                    "trust_mode": "registered-pad",
                    "location": "NiteMarkt back office",
                    "account_id": "ACCT-GUEST",
                    "status": "planned",
                },
            ]
        )
    )
    (data_dir / "carrier-circuits.sample.json").write_text(
        json.dumps(
            [
                {
                    "circuit_id": "CKT-NM-POS-01",
                    "vendor_id": "VEND-NITEMARKT",
                    "terminal_id": "TERM-NM-POS-01",
                    "service_address": "000011",
                    "access_class": "REGISTERED",
                    "status": "planned",
                },
                {
                    "circuit_id": "CKT-NM-WMS-01",
                    "vendor_id": "VEND-NITEMARKT",
                    "terminal_id": "TERM-NM-BOH-01",
                    "service_address": "000020",
                    "access_class": "REGISTERED",
                    "status": "planned",
                },
            ]
        )
    )
    (data_dir / "media-catalog.sample.json").write_text(
        json.dumps(
            [
                {
                    "tape_id": "PUB-0001",
                    "title": "Public Domain Feature 01",
                    "slot": 1,
                    "runtime_minutes": 72,
                    "rights": "public-domain",
                    "status": "available",
                }
            ]
        )
    )
    (data_dir / "print-queues.json").write_text(
        json.dumps(
            [
                {
                    "queue": "receipts",
                    "description": "BBS, PAD, modem, and Media Vault receipts",
                    "operator_visible": True,
                }
            ]
        )
    )


if __name__ == "__main__":
    unittest.main()
