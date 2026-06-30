import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_documents import list_spool, receive_fax, spool_print_job
from tools.omnidat_events import read_events


class DocumentServicesTests(unittest.TestCase):
    def test_spool_print_job_writes_dot_matrix_text_and_event(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            spool_dir = root / "spool"
            log_path = root / "events.jsonl"

            job = spool_print_job(
                spool_dir,
                queue="receipts",
                title="PAD SESSION RECEIPT",
                body="SESSION COMPLETE",
                source="packet-clearing",
                log_path=log_path,
                created_at="2028-07-01T10:00:00-07:00",
            )

            job_path = Path(job["path"])
            self.assertEqual(job["print_job_id"], "PRINT-000001")
            self.assertEqual(job["status"], "spooled")
            self.assertTrue(job_path.exists())
            self.assertIn("OMNIDAT DOCUMENT SERVICES", job_path.read_text())
            self.assertIn("PAD SESSION RECEIPT", job_path.read_text())
            self.assertEqual(read_events(log_path)[0]["type"], "print.printed")

    def test_receive_fax_records_metadata_and_event(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fax_dir = root / "fax"
            log_path = root / "events.jsonl"

            fax = receive_fax(
                fax_dir,
                pages=2,
                number="8818",
                caller="ShadyTel:1234",
                operator_initials="MG",
                log_path=log_path,
                received_at="2028-07-01T10:05:00-07:00",
            )

            record_path = Path(fax["path"])
            self.assertEqual(fax["fax_id"], "FAX-000001")
            self.assertEqual(fax["status"], "received")
            self.assertTrue(record_path.exists())
            self.assertEqual(json.loads(record_path.read_text())["pages"], 2)
            self.assertEqual(read_events(log_path)[0]["type"], "fax.received")

    def test_list_spool_groups_print_jobs_and_faxes(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            spool_dir = root / "spool"
            fax_dir = root / "fax"
            spool_print_job(spool_dir, "logs", "DAILY SUMMARY", "OK", "operator")
            receive_fax(fax_dir, pages=1, number="8818", caller="ShadyTel:5555")

            rendered = list_spool(spool_dir, fax_dir)

            self.assertIn("OMNIDAT DOCUMENT SERVICES QUEUE", rendered)
            self.assertIn("PRINT JOBS: 1", rendered)
            self.assertIn("FAXES: 1", rendered)
            self.assertIn("PRINT-000001", rendered)
            self.assertIn("FAX-000001", rendered)

    def test_spool_print_job_rejects_unknown_queue(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaisesRegex(ValueError, "unknown queue"):
                spool_print_job(Path(temp_dir), "unknown", "TITLE", "BODY", "test")


if __name__ == "__main__":
    unittest.main()
