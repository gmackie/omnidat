import json
import unittest
from pathlib import Path


class GmackoV1AppTests(unittest.TestCase):
    def test_create_gmacko_app_is_durable_not_build_output(self):
        app_root = Path("gmacko")

        self.assertTrue((app_root / "package.json").exists())
        self.assertTrue((app_root / "pnpm-workspace.yaml").exists())
        self.assertTrue((app_root / "apps/nextjs/package.json").exists())
        self.assertTrue((app_root / "packages/db/package.json").exists())

        package = json.loads((app_root / "package.json").read_text())
        self.assertEqual(package["name"], "omnidat-app")
        self.assertEqual(package["scripts"]["dev:emulate"], "npx @gmacko/emulate --portless")
        self.assertIn("@gmacko/emulate", package["devDependencies"])
        self.assertNotIn("@omnidat/emulate", package["devDependencies"])

    def test_next_app_exposes_v1_health_and_signup_routes(self):
        app_root = Path("gmacko/apps/nextjs/src/app")

        self.assertTrue((app_root / "api/health/route.ts").exists())
        self.assertTrue((app_root / "api/health/live/route.ts").exists())
        self.assertTrue((app_root / "api/health/ready/route.ts").exists())
        self.assertTrue((app_root / "api/campsite-apps/route.ts").exists())
        self.assertTrue((app_root / "api/signup/route.ts").exists())

        health_route = (app_root / "api/health/route.ts").read_text()
        self.assertIn("omnidat-v1", health_route)
        self.assertIn("postgres-shared-fryos-v1", health_route)

    def test_next_app_owns_operational_pages_and_trpc_router(self):
        app_root = Path("gmacko/apps/nextjs/src/app")

        self.assertTrue((app_root / "login/page.tsx").exists())
        self.assertTrue((app_root / "console/page.tsx").exists())
        self.assertTrue((app_root / "noc/page.tsx").exists())
        self.assertTrue((app_root / "admin/page.tsx").exists())
        self.assertTrue(Path("gmacko/packages/api/src/router/omnidat.ts").exists())

        home = (app_root / "page.tsx").read_text()
        console = (app_root / "console/page.tsx").read_text()
        noc = (app_root / "noc/page.tsx").read_text()
        admin = (app_root / "admin/page.tsx").read_text()
        root_router = Path("gmacko/packages/api/src/root.ts").read_text()

        self.assertIn("trpc.omnidat.dashboard", home)
        self.assertIn('href="/login"', home)
        self.assertIn('href="/console"', home)
        self.assertIn("PDF Configuration", console)
        self.assertIn("Provisioning Verification", console)
        self.assertIn("Network Operations Center", noc)
        self.assertIn("Circuit State", noc)
        self.assertIn("ShadyBucks Settlement", admin)
        self.assertIn("Service Registry", admin)
        self.assertIn("omnidat: omnidatRouter", root_router)

    def test_next_app_metadata_is_omnidat_not_template(self):
        layout = Path("gmacko/apps/nextjs/src/app/layout.tsx").read_text()

        self.assertIn('title: "OMNIDAT Field Office"', layout)
        self.assertIn("Packet clearing, campsite apps", layout)
        self.assertNotIn('title: "Gmacko App"', layout)

    def test_shared_postgres_schema_uses_omnidat_namespace(self):
        schema = Path("gmacko/packages/db/src/omnidat-schema.ts").read_text()

        self.assertIn('pgSchema("omnidat")', schema)
        self.assertIn("omnidat_campsite", schema)
        self.assertIn("omnidat_campsite_app", schema)
        self.assertIn("omnidat_transport_endpoint", schema)

    def test_operator_core_exports_v1_directory_seed(self):
        core = Path("gmacko/packages/operator-core/src/omnidat.ts").read_text()

        self.assertIn("CAMP LAMINAR MESSAGE DESK", core)
        self.assertIn("MILIWAYS ORDER ENTRY", core)
        self.assertIn("PASSPORT LOG ENTRY", core)
        self.assertIn("MeshCore / Meshtastic gateway", core)

    def test_gmacko_env_example_targets_public_v1_and_shared_schema(self):
        env = Path("gmacko/.env.example").read_text()

        self.assertIn('DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gmacko_dev"', env)
        self.assertIn('OMNIDAT_DB_SCHEMA="omnidat"', env)
        self.assertIn('APP_URL="https://omnidat.gmac.io"', env)
        self.assertIn('NEXT_PUBLIC_APP_URL="https://omnidat.gmac.io"', env)
        self.assertIn('AUTH_GITHUB_ID=""', env)
        self.assertIn('AUTH_GITHUB_SECRET=""', env)
        self.assertIn('AUTH_GOOGLE_ID=""', env)
        self.assertIn('AUTH_GOOGLE_SECRET=""', env)

    def test_forgegraph_config_targets_omnidat_domain_and_shared_postgres(self):
        config = Path("gmacko/.forgegraph.yaml").read_text()

        self.assertIn("app: omnidat-app", config)
        self.assertIn("server: https://forge.gmac.io", config)
        self.assertIn("# healthcheck path: /api/health", config)
        self.assertIn("# database strategy: shared-fryos-postgres-schema", config)
        self.assertIn("# production domain: omnidat.gmac.io", config)


if __name__ == "__main__":
    unittest.main()
