import json
import unittest
from pathlib import Path


class RuntimeManifestTests(unittest.TestCase):
    def test_package_scripts_expose_field_office_runtime(self):
        package = json.loads(Path("package.json").read_text())

        self.assertEqual(package["name"], "omnidat")
        self.assertEqual(package["scripts"]["dev"], "./scripts/ui --port 8828")
        self.assertEqual(package["scripts"]["v1:dev"], "corepack pnpm@10.32.1 --dir gmacko dev:next")
        self.assertEqual(package["scripts"]["v1:build"], "corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build")
        self.assertEqual(package["scripts"]["v1:test"], "corepack pnpm@10.32.1 --dir gmacko test")
        self.assertEqual(package["scripts"]["v1:db:push"], "corepack pnpm@10.32.1 --dir gmacko db:push")
        self.assertEqual(package["scripts"]["scaffold:gmacko"], "./scripts/create-gmacko-app-preview")
        self.assertEqual(package["scripts"]["db:shared:check"], "./scripts/check-shared-postgres")
        self.assertEqual(package["scripts"]["deploy:worker:dry-run"], "wrangler deploy --dry-run")
        self.assertEqual(package["scripts"]["deploy:worker"], "wrangler deploy")
        self.assertEqual(package["scripts"]["health"], "curl -fsS http://127.0.0.1:8828/api/health")
        self.assertEqual(package["scripts"]["test:worker"], "node --test tests/worker/*.test.mjs")
        self.assertEqual(package["scripts"]["test"], "python -m unittest discover -s tests && npm run test:worker --silent")

    def test_wrangler_manifest_targets_omnidat_custom_domain(self):
        manifest = json.loads(Path("wrangler.jsonc").read_text())

        self.assertEqual(manifest["name"], "omnidat")
        self.assertEqual(manifest["main"], "./worker/omnidat-worker.mjs")
        self.assertEqual(manifest["routes"][0]["pattern"], "omnidat.gmac.io")
        self.assertTrue(manifest["routes"][0]["custom_domain"])

    def test_portless_manifest_exposes_omnidat_app(self):
        manifest = json.loads(Path("portless.json").read_text())

        self.assertEqual(manifest["name"], "omnidat")
        self.assertEqual(manifest["apps"]["."]["name"], "omnidat")
        self.assertEqual(manifest["apps"]["."]["script"], "dev")

    def test_integrations_manifest_documents_shared_infra_boundary(self):
        manifest = json.loads(Path("gmacko.integrations.json").read_text())

        self.assertEqual(manifest["preset"], "field-office")
        self.assertTrue(manifest["integrations"]["createGmackoApp"]["enabled"])
        self.assertTrue(manifest["integrations"]["fryosSharedInfra"]["enabled"])
        self.assertEqual(manifest["integrations"]["database"]["provider"], "postgres-shared-fryos-v1")
        self.assertIn("/api/health", manifest["integrations"]["fryosSharedInfra"]["sharedContracts"])
        self.assertFalse(manifest["integrations"]["realtime"]["enabled"])

    def test_env_example_targets_fryos_shared_postgres_for_v1(self):
        env = Path(".env.example").read_text()

        self.assertIn("DATABASE_URL=\"postgresql://postgres:postgres@localhost:5432/gmacko_dev\"", env)
        self.assertIn("OMNIDAT_DB_SCHEMA=\"omnidat\"", env)

    def test_create_gmacko_preview_script_uses_local_fryos_package(self):
        script = Path("scripts/create-gmacko-app-preview").read_text()

        self.assertIn("/Volumes/dev/fryos/packages/create-gmacko-app/dist/index.js", script)
        self.assertIn("--no-mobile", script)
        self.assertIn("--trpc-operators", script)


if __name__ == "__main__":
    unittest.main()
