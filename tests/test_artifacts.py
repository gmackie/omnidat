import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_artifacts import (
    load_json,
    render_all,
    render_asterisk_routes,
    render_packet_directory,
    render_service_directory,
)


class ArtifactRenderingTests(unittest.TestCase):
    def test_service_directory_renders_exchange_88_numbers_in_order(self):
        services = [
            {
                "number": "8801",
                "name": "Network Status",
                "description": "Recorded announcements",
                "route_class": "ivr",
                "owner": "PBX/ops",
            },
            {
                "number": "8800",
                "name": "OMNIDAT TrustDesk",
                "description": "Directory and human assistance",
                "route_class": "operator",
                "owner": "PBX/operator",
            },
        ]

        rendered = render_service_directory(services)

        self.assertIn("OMNIDAT EXCHANGE 88 SERVICE DIRECTORY", rendered)
        self.assertLess(rendered.index("8800"), rendered.index("8801"))
        self.assertIn("8800  OMNIDAT TrustDesk", rendered)
        self.assertIn("8801  Network Status", rendered)

    def test_packet_directory_renders_pad_call_table(self):
        packet_services = [
            {
                "address": "000004",
                "name": "MEDIA VAULT CATALOG",
                "access_class": "PUBLIC",
                "description": "Tape catalog and queue status",
            },
            {
                "address": "000001",
                "name": "OMNIDAT DIRECTORY",
                "access_class": "PUBLIC",
                "description": "Packet service directory",
            },
        ]

        rendered = render_packet_directory(packet_services)

        self.assertIn("OMNIDAT PACKET CLEARING DIRECTORY", rendered)
        self.assertLess(rendered.index("000001"), rendered.index("000004"))
        self.assertIn("PAD> CALL 000001", rendered)
        self.assertIn("PAD> CALL 000004", rendered)

    def test_asterisk_routes_use_service_route_classes(self):
        services = [
            {
                "number": "8800",
                "service_id": "trustdesk",
                "route_class": "operator",
            },
            {
                "number": "8802",
                "service_id": "omnidat-online",
                "route_class": "hunt",
            },
        ]

        rendered = render_asterisk_routes(services)

        self.assertIn("exten => 8800,1,Goto(omnidat-operator,trustdesk,1)", rendered)
        self.assertIn("exten => 8802,1,Goto(omnidat-hunt,omnidat-online,1)", rendered)

    def test_render_all_writes_artifacts_from_data_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            output_dir = root / "build"
            data_dir.mkdir()
            (data_dir / "services.json").write_text(
                json.dumps(
                    [
                        {
                            "number": "8800",
                            "service_id": "trustdesk",
                            "name": "OMNIDAT TrustDesk",
                            "description": "Directory and human assistance",
                            "route_class": "operator",
                            "owner": "PBX/operator",
                        }
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
                        }
                    ]
                )
            )

            written = render_all(data_dir, output_dir)

            self.assertEqual(
                sorted(path.name for path in written),
                [
                    "asterisk-routes.conf",
                    "packet-directory.txt",
                    "service-directory.txt",
                ],
            )
            self.assertIn("OMNIDAT TrustDesk", (output_dir / "service-directory.txt").read_text())
            self.assertIn("PAD> CALL 000001", (output_dir / "packet-directory.txt").read_text())

    def test_load_json_reports_missing_file_path(self):
        with self.assertRaisesRegex(FileNotFoundError, "missing.json"):
            load_json(Path("missing.json"))


if __name__ == "__main__":
    unittest.main()
