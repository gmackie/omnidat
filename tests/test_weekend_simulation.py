import json
import tempfile
import unittest
from pathlib import Path

from tools.omnidat_journal import JournalStore
from tools.omnidat_weekend import run_weekend_simulation


class FakeResponse:
    def __init__(self, body):
        self._body = json.dumps(body).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class RecordingTransport:
    """Fake sync transport: every syncPush applies all sent entries."""

    def __init__(self):
        self.pushes = 0

    def __call__(self, request):
        procedure = request.full_url.rsplit("/", 1)[-1]
        body = json.loads(request.data.decode("utf-8"))["json"]
        if procedure == "omnidat.syncPush":
            self.pushes += 1
            count = len(body["entries"])
            return FakeResponse(
                {
                    "result": {
                        "data": {
                            "json": {
                                "applied": count,
                                "duplicate": 0,
                                "rejectedStale": 0,
                                "quarantined": 0,
                                "highWatermark": count,
                                "authority": {"holder": "field", "epoch": 1},
                            }
                        }
                    }
                }
            )
        return FakeResponse(
            {
                "result": {
                    "data": {
                        "json": {
                            "entries": [],
                            "authority": {
                                "holder": "field",
                                "holderSourceId": "sim-field-kit",
                                "epoch": 1,
                            },
                        }
                    }
                }
            }
        )


class WeekendSimulationTests(unittest.TestCase):
    def test_weekend_simulation_runs_thousand_camper_camp_economy(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_dir = Path(temp_dir)

            report = run_weekend_simulation(
                runtime_dir=runtime_dir,
                data_dir=Path("data"),
                camper_count=1000,
            )

            self.assertEqual(report["status"], "passed")
            self.assertEqual(report["scenario"], "omnidat-full-camp-weekend")
            self.assertEqual(report["campers"]["count"], 1000)
            self.assertEqual(report["campers"]["seed_amount"], "80.00")
            self.assertEqual(report["campers"]["total_seeded"], "80000.00")
            self.assertEqual(report["campers"]["negative_balances"], 0)
            self.assertEqual(report["identity"]["provider"], "omniauth")
            self.assertEqual(report["identity"]["accounts"], 1000)
            self.assertEqual(report["identity"]["unique_subjects"], 1000)
            self.assertEqual(report["night_market"]["nights"], 2)
            self.assertGreaterEqual(report["night_market"]["sales"], 900)
            self.assertEqual(report["night_market"]["captured"], report["night_market"]["sales"])
            self.assertEqual(report["miliways"]["service_windows"], 4)
            self.assertGreaterEqual(report["miliways"]["orders"], 1200)
            self.assertEqual(report["miliways"]["tickets_issued"], report["miliways"]["orders"])
            self.assertGreaterEqual(report["x121_provisioning"]["campsites"], 12)
            self.assertEqual(report["x121_provisioning"]["verified"], report["x121_provisioning"]["campsites"])
            self.assertGreaterEqual(report["merchants"]["count"], 5)
            self.assertEqual(report["merchants"]["pos_terminals_connected"], report["merchants"]["count"])
            self.assertEqual(report["merchants"]["accounts_configured"], report["merchants"]["count"])
            self.assertEqual(report["merchants"]["settlement_accounts_linked"], report["merchants"]["count"])
            self.assertEqual(report["bank"]["response_codes"], {"00": report["night_market"]["sales"]})
            self.assertGreaterEqual(report["historical_records"]["deployments"], 3)
            self.assertIn("toorcamp-2028-planning", report["historical_records"]["records"])
            self.assertEqual(report["forms"]["total_filed"], 340)
            self.assertEqual(report["forms"]["by_type"]["campsite-provisioning"], 12)
            self.assertGreaterEqual(report["forms"]["by_type"]["merchant-onboarding"], 5)
            self.assertGreaterEqual(report["forms"]["by_type"]["activity-passport"], 200)
            self.assertEqual(report["terminals"]["total_sessions"], 312)
            self.assertGreaterEqual(report["terminals"]["by_program"]["OMNISALE.TCL"], 100)
            self.assertGreaterEqual(report["terminals"]["by_program"]["OMNIFOOD.TCL"], 80)
            self.assertGreaterEqual(report["terminals"]["by_program"]["OMNIDIR.TCL"], 50)
            self.assertGreaterEqual(report["terminals"]["by_program"]["OMNIPASS.TCL"], 50)
            self.assertIn("load_factor", report["terminals"])
            self.assertEqual(report["terminals"].get("congested_sessions", 0), 0)  # default no saturation
            self.assertEqual(report["evidence"]["event_log"]["events"], 5888)
            self.assertEqual(report["evidence"]["bank_ledger"]["events"], 2000)
            self.assertEqual(report["evidence"]["queue_orders"]["records"], 1600)
            self.assertEqual(report["network_fees"]["ledger_records"], 1544)
            self.assertEqual(report["network_fees"]["total_assessed"], "181.86")
            self.assertEqual(report["network_fees"]["by_mode"]["percentage"]["records"], 1000)
            self.assertEqual(report["network_fees"]["by_mode"]["per-message"]["records"], 312)
            self.assertEqual(report["network_fees"]["by_mode"]["flat"]["records"], 12)
            self.assertEqual(report["network_fees"]["by_mode"]["waived"]["records"], 220)
            self.assertEqual(report["network_fees"]["statements"]["count"], 7)
            self.assertEqual(report["network_fees"]["statements"]["total_assessed"], "181.86")
            self.assertEqual(report["network_fees"]["statements"]["by_account"][0]["account_id"], "OMNI-NIGHTMARKT")
            self.assertEqual(report["network_fees"]["statements"]["by_account"][0]["gross"], "1400.00")
            self.assertEqual(report["network_fees"]["statements"]["by_account"][0]["network_fees"], "17.50")
            self.assertEqual(report["network_fees"]["statements"]["by_account"][0]["artifact"], "billing-statements/OMNI-NIGHTMARKT.txt")
            self.assertEqual(report["network_fees"]["statements"]["by_account"][-1]["account_id"], "OMNIDAT-CAMPSITE-BUREAU")
            self.assertEqual(report["network_fees"]["statements"]["by_account"][-1]["network_fees"], "60.00")
            self.assertEqual(report["network_fees"]["statements"]["by_account"][-1]["artifact"], "billing-statements/OMNIDAT-CAMPSITE-BUREAU.txt")
            self.assertEqual(report["evidence"]["billing_statements"]["records"], 7)
            self.assertEqual(report["evidence"]["network_fee_ledger"]["records"], 1544)
            self.assertEqual(report["samples"]["forms"][0]["form_type"], "campsite-provisioning")
            self.assertEqual(report["samples"]["terminal_sessions"][0]["program"], "OMNISALE.TCL")
            self.assertEqual(report["samples"]["merchant_setups"][0]["settlement_currency"], "OmniBucks")
            self.assertEqual(report["samples"]["x121_assignments"][0]["verified"], True)
            self.assertTrue((runtime_dir / "weekend-report.json").exists())
            self.assertTrue((runtime_dir / "weekend-events.jsonl").exists())
            self.assertTrue((runtime_dir / "weekend-bank-ledger.jsonl").exists())
            self.assertTrue((runtime_dir / "weekend-network-fees.jsonl").exists())
            self.assertTrue((runtime_dir / "billing-statements" / "OMNI-NIGHTMARKT.txt").exists())
            self.assertTrue((runtime_dir / "billing-statements" / "OMNIDAT-CAMPSITE-BUREAU.txt").exists())
            self.assertIn("OMNIDAT NETWORK FEE STATEMENT", (runtime_dir / "billing-statements" / "OMNI-NIGHTMARKT.txt").read_text())
            self.assertIn("NETWORK FEES 17.50 OmniBucks", (runtime_dir / "billing-statements" / "OMNI-NIGHTMARKT.txt").read_text())

    def test_worker_dashboard_journal_total_matches_the_sim(self):
        # The public dashboard embeds the sim field kit journal total; it must
        # equal what the simulation actually produces so the dashboard cannot
        # silently drift from the run it claims to show.
        with tempfile.TemporaryDirectory() as temp_dir:
            report = run_weekend_simulation(
                runtime_dir=Path(temp_dir),
                data_dir=Path("data"),
                camper_count=1000,
            )
        worker = Path("worker/omnidat-worker.mjs").read_text()
        self.assertIn(f"total: {report['journal']['total']}", worker)
        self.assertIn('sourceId: "sim-field-kit"', worker)

    def test_weekend_simulation_journals_through_sim_field_kit(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_dir = Path(temp_dir)

            report = run_weekend_simulation(
                runtime_dir=runtime_dir,
                data_dir=Path("data"),
                camper_count=1000,
            )

            journal = report["journal"]
            self.assertEqual(journal["source_id"], "sim-field-kit")
            expected_total = (
                report["evidence"]["event_log"]["events"]
                + report["evidence"]["bank_ledger"]["events"]
                + report["evidence"]["network_fee_ledger"]["records"]
            )
            self.assertEqual(journal["total"], expected_total)
            self.assertGreater(len(journal["per_op_type"]), 1)
            self.assertEqual(
                sum(journal["per_op_type"].values()), journal["total"]
            )
            # The journal database is a durable artifact on the sim field kit.
            store = JournalStore(
                runtime_dir / "sim-field-kit-journal.db", source_id="sim-field-kit"
            )
            self.addCleanup(store.close)
            self.assertEqual(len(store.entries()), expected_total)
            # No sync target configured: journal-local, no reconciliation.
            self.assertIsNone(journal["sync"])

    def test_uplink_outage_window_loses_zero_records(self):
        # Exit gate: pull the uplink for a 60+ simulated-minute window mid-sim.
        # Every journaled op must still reach the cloud on recovery with a clean
        # reconciliation, and field-office flows must complete during the outage.
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_dir = Path(temp_dir)
            transport = RecordingTransport()

            report = run_weekend_simulation(
                runtime_dir=runtime_dir,
                data_dir=Path("data"),
                camper_count=1000,
                sync_target="https://cloud.test",
                sync_token="sim-secret",
                sync_transport=transport,
                outage_window=("2028-07-01T09:00:00-07:00", "2028-07-02T13:00:00-07:00"),
            )

            outage = report["journal"]["outage"]
            self.assertGreaterEqual(outage["refused_pushes"], 1)
            self.assertGreaterEqual(outage["simulated_minutes"], 60)
            sync = report["journal"]["sync"]
            self.assertEqual(sync["status"], "ok")
            self.assertEqual(
                sync["applied"] + sync["duplicate"], report["journal"]["total"]
            )
            self.assertEqual(sync["rejected_stale"], 0)
            # Field-office flows completed during the outage window: Miliways
            # orders (created during the window) are present in the journal.
            self.assertGreater(
                report["journal"]["per_op_type"].get("queue.order.accepted", 0), 0
            )

    def test_weekend_simulation_pushes_journal_when_sync_target_configured(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime_dir = Path(temp_dir)
            transport = RecordingTransport()

            report = run_weekend_simulation(
                runtime_dir=runtime_dir,
                data_dir=Path("data"),
                camper_count=1000,
                sync_target="https://cloud.test",
                sync_token="sim-secret",
                sync_transport=transport,
            )

            sync = report["journal"]["sync"]
            self.assertIsNotNone(sync)
            self.assertGreaterEqual(transport.pushes, 1)
            self.assertEqual(sync["applied"], report["journal"]["total"])
            self.assertEqual(sync["duplicate"], 0)
            self.assertEqual(sync["rejected_stale"], 0)


if __name__ == "__main__":
    unittest.main()
