import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_activity import read_activity_records
from tools.omnidat_queue import read_orders
from tools.omnidat_radio_pad import handle_command, parse_command


class RadioPadTests(unittest.TestCase):
    def test_parse_command_splits_verb_and_arguments(self):
        parsed = parse_command("REQ 020501 ORDER tea PASS-04271")

        self.assertEqual(parsed["verb"], "REQ")
        self.assertEqual(parsed["args"], ["020501", "ORDER", "tea", "PASS-04271"])

    def test_help_returns_compact_command_list(self):
        response = handle_command(command="HELP")

        self.assertIn("OMNIDAT FIELD PAD", response)
        self.assertIn("REQ <ADDR>", response)

    def test_dir_lists_core_and_campsite_apps(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            write_radio_seed_data(data_dir)

            response = handle_command(command="DIR", data_dir=data_dir)

            self.assertIn("000001 OMNIDAT DIRECTORY", response)
            self.assertIn("020184 CAMP LAMINAR MESSAGE DESK", response)

    def test_call_campsite_app_returns_connection_notice(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            write_radio_seed_data(data_dir)

            response = handle_command(command="CALL 020184", data_dir=data_dir)

            self.assertIn("CALL 020184", response)
            self.assertIn("CAMP LAMINAR MESSAGE DESK", response)
            self.assertIn("CLR 00", response)

    def test_req_order_creates_miliways_ticket(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            write_radio_seed_data(data_dir)

            response = handle_command(
                command="REQ 020501 ORDER tea PASS-04271",
                data_dir=data_dir,
                queue_dir=queue_dir,
            )

            self.assertIn("TKT MLY-000001", response)
            self.assertIn("POS 1", response)
            self.assertEqual(read_orders(queue_dir)[0]["passport_id"], "PASS-04271")

    def test_req_order_bridges_to_fryos(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            write_radio_seed_data(data_dir)
            bridge = FakeFryosBridge()

            response = handle_command(
                command="REQ 020501 ORDER tea PASS-04271",
                data_dir=data_dir,
                queue_dir=queue_dir,
                fryos_bridge=bridge,
            )

            self.assertIn("TKT MLY-000001", response)
            self.assertEqual(read_orders(queue_dir)[0]["fryos_order_id"], "fryos-order-1")
            self.assertEqual(bridge.created_orders[0]["items"][0]["menuItemId"], "fryos-tea")

    def test_stat_returns_queue_position(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            write_radio_seed_data(data_dir)
            handle_command("REQ 020501 ORDER tea PASS-04271", data_dir=data_dir, queue_dir=queue_dir)

            response = handle_command("STAT 020502 MLY-000001", data_dir=data_dir, queue_dir=queue_dir)

            self.assertIn("TKT MLY-000001", response)
            self.assertIn("STATUS ACCEPTED", response)

    def test_act_logs_passport_activity(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            activity_dir = root / "activity"
            write_radio_seed_data(data_dir)

            response = handle_command(
                "ACT PASS-04271 020184 WORKSHOP-COMPLETE",
                data_dir=data_dir,
                activity_dir=activity_dir,
            )

            self.assertIn("ACT ACT-000001", response)
            self.assertEqual(read_activity_records(activity_dir)[0]["action"], "WORKSHOP-COMPLETE")


def write_radio_seed_data(data_dir: Path) -> None:
    data_dir.mkdir()
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
                    "description": "Campsite message desk",
                },
                {
                    "address": "020501",
                    "owner_name": "Miliways",
                    "app_name": "Miliways Order Entry",
                    "template": "QUEUE",
                    "access_class": "PASSPORT",
                    "directory_status": "official",
                    "status": "active",
                    "transports": ["hosted-node", "meshcore-radio-pad"],
                    "description": "Food order intake",
                },
                {
                    "address": "020502",
                    "owner_name": "Miliways",
                    "app_name": "Miliways Queue Position",
                    "template": "QUEUE",
                    "access_class": "PUBLIC",
                    "directory_status": "official",
                    "status": "active",
                    "transports": ["hosted-node", "meshcore-radio-pad"],
                    "description": "Food queue status",
                },
            ]
        )
    )
    (data_dir / "activity-passports.sample.json").write_text(
        json.dumps(
            [
                {
                    "passport_id": "PASS-04271",
                    "handle": "RED-LINE-27",
                    "access_class": "PASSPORT",
                    "status": "active",
                }
            ]
        )
    )
    (data_dir / "queue-apps.sample.json").write_text(
        json.dumps(
            [
                {
                    "queue_id": "miliways",
                    "name": "Miliways",
                    "ticket_prefix": "MLY",
                    "service_address": "020501",
                    "items": [
                        {
                            "item_id": "tea",
                            "name": "Tea",
                            "status": "available",
                            "fryos_menu_item_id": "fryos-tea",
                        }
                    ],
                }
            ]
        )
    )


class FakeFryosBridge:
    def __init__(self) -> None:
        self.created_orders = []

    def create_order(self, payload):
        self.created_orders.append(payload)
        return {
            "id": "fryos-order-1",
            "orderNumber": 86,
            "paymentStatus": "pending",
        }

    def get_order(self, order_id):
        return None


if __name__ == "__main__":
    unittest.main()
