import json
import unittest
from pathlib import Path


class V1DeployReadinessTests(unittest.TestCase):
    def test_wrangler_declares_cloudflare_worker_as_public_web_ui(self):
        config = json.loads(Path("wrangler.jsonc").read_text())

        self.assertEqual(config["name"], "omnidat")
        self.assertEqual(config["main"], "./worker/omnidat-worker.mjs")
        self.assertEqual(
            config["routes"],
            [{"pattern": "omnidat.gmac.io", "custom_domain": True}],
        )
        self.assertEqual(config["vars"]["APP_ENV"], "production")
        self.assertEqual(config["vars"]["APP_URL"], "https://omnidat.gmac.io")
        self.assertEqual(config["vars"]["OMNIDAT_PERSISTENCE"], "database")
        self.assertEqual(config["vars"]["OMNIDAT_DB_SCHEMA"], "omnidat")
        self.assertEqual(config["vars"]["DATABASE_PROVIDER"], "postgres-shared-fryos-v1")
        self.assertEqual(
            config["hyperdrive"],
            [
                {
                    "binding": "HYPERDRIVE",
                    "id": "0bd753e5676f4195ac6047e9dd531bf3",
                },
            ],
        )

    def test_worker_is_not_a_provisional_static_shell(self):
        worker = Path("worker/omnidat-worker.mjs").read_text()

        self.assertIn('"omnidat-v1-worker"', worker)
        self.assertIn('database: "postgres-shared-fryos-v1"', worker)
        self.assertIn('schema: "omnidat"', worker)
        self.assertIn('url.pathname === "/api/campsite-apps"', worker)
        self.assertIn('url.pathname === "/api/signup"', worker)
        self.assertNotIn("static-provisional", worker)
        self.assertNotIn("provisional edge office", worker)

    def test_worker_declares_operational_x25_control_plane(self):
        worker = Path("worker/omnidat-worker.mjs").read_text()

        self.assertIn('url.pathname === "/api/network"', worker)
        self.assertIn('url.pathname === "/api/services"', worker)
        self.assertIn('url.pathname === "/api/provisioning"', worker)
        self.assertIn('url.pathname === "/api/billing/accounts"', worker)
        self.assertIn('url.pathname === "/api/protocols/shadybucks-atm"', worker)
        self.assertIn('url.pathname === "/api/protocols/food-service"', worker)
        self.assertIn("X25_STATUS_URL", worker)
        self.assertIn("ShadyBucks", worker)

    def test_runbook_documents_worker_v1_smoke_tests(self):
        runbook = Path("runbooks/cloudflare-worker-deploy.md").read_text()

        self.assertIn("canonical public web UI", runbook)
        self.assertIn("npm run deploy:worker --silent", runbook)
        self.assertIn("https://omnidat.gmac.io/api/campsite-apps", runbook)
        self.assertIn("POST https://omnidat.gmac.io/api/signup", runbook)
        self.assertNotIn("temporary public edge deploy", runbook)
        self.assertNotIn("full v1 application is still expected to move", runbook)


if __name__ == "__main__":
    unittest.main()
