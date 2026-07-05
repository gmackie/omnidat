import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_events import read_events
from tools.omnidat_journal import JournalStore, JournalWriter
from tools.omnidat_queue import (
    create_order,
    get_order_status,
    list_menu,
    read_orders,
    render_order_receipt,
    update_order_status,
)


class QueueTests(unittest.TestCase):
    def test_list_menu_renders_available_items(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            write_queue_seed_data(data_dir)

            rendered = list_menu(data_dir, "miliways")

            self.assertIn("MILIWAYS MENU STATUS", rendered)
            self.assertIn("TEA  AVAILABLE", rendered)
            self.assertIn("PANCAKES  SOLD OUT", rendered)

    def test_create_order_writes_ticket_and_event(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            log_path = root / "events.jsonl"
            write_queue_seed_data(data_dir)

            order = create_order(
                data_dir,
                queue_dir,
                queue_id="miliways",
                passport_id="PASS-04271",
                item_id="tea",
                quantity=2,
                log_path=log_path,
                created_at="2028-07-01T10:00:00-07:00",
            )

            self.assertEqual(order["ticket_id"], "MLY-000001")
            self.assertEqual(order["status"], "accepted")
            self.assertEqual(order["queue_position"], 1)
            self.assertEqual(read_orders(queue_dir), [order])
            self.assertEqual(read_events(log_path)[0]["type"], "queue.order.accepted")

    def test_create_order_appends_journal_entry_when_store_attached(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            write_queue_seed_data(data_dir)
            store = JournalStore(root / "journal.db", source_id="field-kit-01")
            self.addCleanup(store.close)
            store.set_authority("event-sim", "field-kit-01", 1)
            journal = JournalWriter(store, "event-sim")

            order = create_order(
                data_dir,
                queue_dir,
                queue_id="miliways",
                passport_id="PASS-04271",
                item_id="tea",
                quantity=1,
                created_at="2028-07-01T10:00:00-07:00",
                journal=journal,
            )

            entries = store.entries()
            self.assertEqual(len(entries), 1)
            self.assertEqual(entries[0]["op_type"], "queue.order.accepted")
            self.assertEqual(entries[0]["event_id"], "event-sim")
            self.assertEqual(entries[0]["payload"], order)

    def test_create_order_bridges_to_fryos_when_item_has_mapping(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            write_queue_seed_data(data_dir)
            bridge = FakeFryosBridge()

            order = create_order(
                data_dir,
                queue_dir,
                queue_id="miliways",
                passport_id="PASS-04271",
                item_id="tea",
                quantity=2,
                fryos_bridge=bridge,
                payment_method="shadybucks",
            )

            self.assertEqual(
                bridge.created_orders,
                [
                    {
                        "source": "pos",
                        "paymentMethod": "shadybucks",
                        "items": [
                            {
                                "menuItemId": "fryos-tea",
                                "quantity": 2,
                                "modifiers": ["omnidat:020501", "passport:PASS-04271"],
                            }
                        ],
                    }
                ],
            )
            self.assertEqual(order["fryos_order_id"], "fryos-order-1")
            self.assertEqual(order["fryos_order_number"], 86)
            self.assertEqual(order["fryos_payment_status"], "pending")

    def test_get_order_status_refreshes_status_from_fryos_bridge(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            write_queue_seed_data(data_dir)
            bridge = FakeFryosBridge()
            created = create_order(
                data_dir,
                queue_dir,
                "miliways",
                "PASS-04271",
                "tea",
                1,
                fryos_bridge=bridge,
            )
            bridge.status_by_id[created["fryos_order_id"]] = {
                "status": "ready",
                "paymentStatus": "charged",
            }

            status = get_order_status(queue_dir, created["ticket_id"], fryos_bridge=bridge)

            self.assertEqual(status["status"], "ready")
            self.assertEqual(status["queue_position"], None)
            self.assertEqual(status["fryos_payment_status"], "charged")

    def test_create_order_rejects_sold_out_item(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            write_queue_seed_data(data_dir)

            with self.assertRaises(ValueError):
                create_order(
                    data_dir,
                    root / "queue",
                    queue_id="miliways",
                    passport_id="PASS-04271",
                    item_id="pancakes",
                    quantity=1,
                )

    def test_get_order_status_reports_position(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            write_queue_seed_data(data_dir)
            first = create_order(data_dir, queue_dir, "miliways", "PASS-04271", "tea", 1)
            second = create_order(data_dir, queue_dir, "miliways", "PASS-02024", "tea", 1)

            status = get_order_status(queue_dir, second["ticket_id"])

            self.assertEqual(status["ticket_id"], "MLY-000002")
            self.assertEqual(status["queue_position"], 2)
            self.assertEqual(first["ticket_id"], "MLY-000001")

    def test_update_order_status_moves_ticket_out_of_waiting_queue(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            queue_dir = root / "queue"
            write_queue_seed_data(data_dir)
            first = create_order(data_dir, queue_dir, "miliways", "PASS-04271", "tea", 1)
            second = create_order(data_dir, queue_dir, "miliways", "PASS-02024", "tea", 1)

            updated = update_order_status(
                queue_dir,
                first["ticket_id"],
                "ready",
                updated_at="2028-07-01T10:10:00-07:00",
            )
            second_status = get_order_status(queue_dir, second["ticket_id"])

            self.assertEqual(updated["status"], "ready")
            self.assertEqual(second_status["queue_position"], 1)

    def test_render_order_receipt_is_printable(self):
        order = {
            "ticket_id": "MLY-000001",
            "passport_id": "PASS-04271",
            "handle": "RED-LINE-27",
            "item_name": "Tea",
            "quantity": 2,
            "status": "accepted",
            "queue_position": 1,
            "created_at": "2028-07-01T10:00:00-07:00",
        }

        rendered = render_order_receipt(order)

        self.assertIn("MILIWAYS SERVICE BUREAU", rendered)
        self.assertIn("TICKET: MLY-000001", rendered)
        self.assertIn("PRESENT RECEIPT", rendered)


def write_queue_seed_data(data_dir: Path) -> None:
    data_dir.mkdir()
    (data_dir / "activity-passports.sample.json").write_text(
        json.dumps(
            [
                {
                    "passport_id": "PASS-04271",
                    "handle": "RED-LINE-27",
                    "access_class": "PASSPORT",
                    "status": "active",
                },
                {
                    "passport_id": "PASS-02024",
                    "handle": "BLUE-FORM-12",
                    "access_class": "PASSPORT",
                    "status": "active",
                },
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
                        },
                        {"item_id": "pancakes", "name": "Pancakes", "status": "sold_out"},
                    ],
                }
            ]
        )
    )


class FakeFryosBridge:
    def __init__(self) -> None:
        self.created_orders = []
        self.status_by_id = {}

    def create_order(self, payload):
        self.created_orders.append(payload)
        return {
            "id": "fryos-order-1",
            "orderNumber": 86,
            "paymentStatus": "pending",
        }

    def get_order(self, order_id):
        return self.status_by_id.get(order_id)


if __name__ == "__main__":
    unittest.main()
