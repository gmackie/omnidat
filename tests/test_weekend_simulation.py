import tempfile
import unittest
from pathlib import Path

from tools.omnidat_weekend import run_weekend_simulation


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
            self.assertEqual(report["evidence"]["event_log"]["events"], 5888)
            self.assertEqual(report["evidence"]["bank_ledger"]["events"], 2000)
            self.assertEqual(report["evidence"]["queue_orders"]["records"], 1600)
            self.assertEqual(report["network_fees"]["ledger_records"], 1544)
            self.assertEqual(report["network_fees"]["total_assessed"], "181.86")
            self.assertEqual(report["network_fees"]["by_mode"]["percentage"]["records"], 1000)
            self.assertEqual(report["network_fees"]["by_mode"]["per-message"]["records"], 312)
            self.assertEqual(report["network_fees"]["by_mode"]["flat"]["records"], 12)
            self.assertEqual(report["network_fees"]["by_mode"]["waived"]["records"], 220)
            self.assertEqual(report["evidence"]["network_fee_ledger"]["records"], 1544)
            self.assertEqual(report["samples"]["forms"][0]["form_type"], "campsite-provisioning")
            self.assertEqual(report["samples"]["terminal_sessions"][0]["program"], "OMNISALE.TCL")
            self.assertEqual(report["samples"]["merchant_setups"][0]["settlement_currency"], "OmniBucks")
            self.assertEqual(report["samples"]["x121_assignments"][0]["verified"], True)
            self.assertTrue((runtime_dir / "weekend-report.json").exists())
            self.assertTrue((runtime_dir / "weekend-events.jsonl").exists())
            self.assertTrue((runtime_dir / "weekend-bank-ledger.jsonl").exists())
            self.assertTrue((runtime_dir / "weekend-network-fees.jsonl").exists())


if __name__ == "__main__":
    unittest.main()
