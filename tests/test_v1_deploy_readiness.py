import unittest
from pathlib import Path


class V1DeployReadinessTests(unittest.TestCase):
    def test_root_dockerfile_builds_omnidat_next_app(self):
        dockerfile = Path("gmacko/Dockerfile").read_text()

        self.assertIn("corepack prepare pnpm@10.32.1 --activate", dockerfile)
        self.assertIn("COPY packages/operator-core/package.json ./packages/operator-core/", dockerfile)
        self.assertIn("COPY packages/logging/package.json ./packages/logging/", dockerfile)
        self.assertIn("COPY packages/telemetry/package.json ./packages/telemetry/", dockerfile)
        self.assertIn("COPY packages/i18n/package.json ./packages/i18n/", dockerfile)
        self.assertIn("RUN pnpm turbo run build --filter=@omnidat/nextjs", dockerfile)
        self.assertNotIn("@gmacko/nextjs", dockerfile)

    def test_dockerfile_uses_v1_public_env_and_healthcheck(self):
        dockerfile = Path("gmacko/Dockerfile").read_text()

        self.assertIn("ARG OMNIDAT_DB_SCHEMA=omnidat", dockerfile)
        self.assertIn("ARG APP_URL=https://omnidat.gmac.io", dockerfile)
        self.assertIn("ARG NEXT_PUBLIC_APP_URL=https://omnidat.gmac.io", dockerfile)
        self.assertIn("ENV OMNIDAT_DB_SCHEMA=${OMNIDAT_DB_SCHEMA}", dockerfile)
        self.assertIn("ENV APP_URL=${APP_URL}", dockerfile)
        self.assertIn("ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}", dockerfile)
        self.assertIn("http://localhost:3000/api/health", dockerfile)

    def test_forgegraph_config_declares_real_stage_targets(self):
        config = Path("gmacko/.forgegraph.yaml").read_text()

        self.assertIn("nodeId: hetzner-master", config)
        self.assertIn("production domain: omnidat.gmac.io", config)
        self.assertNotIn("change-me-production-node", config)
        self.assertNotIn("change-me-staging-node", config)


if __name__ == "__main__":
    unittest.main()
