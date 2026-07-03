import json
import unittest
from pathlib import Path


class OmniTelPbxTests(unittest.TestCase):
    def test_omnitel_peer_profile_defines_bootstrap_shadytel_style_exchange(self):
        peers = json.loads(Path("data/telephony-peers.sample.json").read_text())
        omnitel = next(peer for peer in peers if peer["peer_id"] == "omnitel")

        self.assertEqual(omnitel["display_name"], "OmniTel")
        self.assertEqual(omnitel["role"], "bootstrap-shadytel-peer")
        self.assertEqual(omnitel["ingress_trunk"], "pjsip/omnitel-lab")
        self.assertEqual(omnitel["number_block"], "8800-8823")
        self.assertIn("Raspberry Pi", omnitel["lab_hardware"])
        self.assertIn("USB modem bank", omnitel["lab_hardware"])
        self.assertIn("similar to FurryTel at Black Rock", omnitel["notes"])

    def test_asterisk_configs_define_omnitel_peer_and_terminal_service_routes(self):
        pjsip = Path("configs/asterisk/pjsip-omnidat-lab.conf").read_text()
        extensions = Path("configs/asterisk/extensions-omnidat.conf").read_text()

        self.assertIn("[omnitel-lab]", pjsip)
        self.assertIn("contact=sip:127.0.0.1:5063", pjsip)
        for route in [
            "exten => 8810,1,Goto(omnidat-hunt,packet-main,1)",
            "exten => 8811,1,Goto(omnidat-hunt,terminal-updates,1)",
            "exten => 8812,1,Goto(omnidat-hunt,nightmarkt-directory,1)",
            "exten => 8813,1,Goto(omnidat-hunt,miliways-food,1)",
            "exten => 8814,1,Goto(omnidat-hunt,activity-passport,1)",
        ]:
            self.assertIn(route, extensions)

        for endpoint in [
            "pad-update-01",
            "pad-directory-01",
            "pad-food-01",
            "pad-passport-01",
        ]:
            self.assertIn(endpoint, extensions)

    def test_raspi_asterisk_runbook_covers_usb_modem_turnup(self):
        runbook = Path("runbooks/omnitel-raspi-pbx.md").read_text()

        for expected in [
            "Raspberry Pi",
            "Asterisk",
            "USB modem",
            "8810",
            "8811",
            "8812",
            "8813",
            "8814",
            "VeriFone simulator",
            "OmniTel",
            "ShadyTel",
        ]:
            self.assertIn(expected, runbook)


if __name__ == "__main__":
    unittest.main()
