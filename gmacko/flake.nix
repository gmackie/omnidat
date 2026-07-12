{
  description = "create-gmacko-app template shell for ForgeGraph-style deployments";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      packageSystems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      packages = nixpkgs.lib.genAttrs packageSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          # pnpm only fetches/links dependencies here. Keep its runtime on
          # Node 22 because nixpkgs' Node 24 build currently aborts inside
          # fetchPnpmDeps on Darwin; the application itself builds and runs
          # with Node 24 below.
          fetchPnpm = pkgs.pnpm_10.override { nodejs-slim = pkgs.nodejs-slim_22; };
        in {
          default = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "omnidat-app";
            version = "0.1.0";
            src = ./.;

            nativeBuildInputs = [
              pkgs.nodejs_24
              pkgs.pnpm_10
              pkgs.pnpmConfigHook
            ];

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname version src;
              pnpm = fetchPnpm;
              fetcherVersion = 4;
              hash = "sha256-wUPGk3yxPJz61dG3nbsnx9M13DevvuAURETI0jL1U7E=";
            };

            SKIP_ENV_VALIDATION = "true";
            DOCKER_BUILD = "true";
            NEXT_TELEMETRY_DISABLED = "1";
            NODE_ENV = "production";
            CI = "1";
            TURBO_UI = "false";
            NODE_OPTIONS = "--max-old-space-size=4096";
            NEXT_BUILD_CPUS = "2";

            buildPhase = ''
              runHook preBuild
              pnpm --filter @omnidat/nextjs... build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              mkdir -p $out/share/omnidat-app
              cp -r apps/nextjs/.next/standalone/. $out/share/omnidat-app/
              mkdir -p $out/share/omnidat-app/apps/nextjs/.next
              cp -r apps/nextjs/.next/static $out/share/omnidat-app/apps/nextjs/.next/static
              cp -r apps/nextjs/public $out/share/omnidat-app/apps/nextjs/public

              mkdir -p $out/bin
              cat > $out/bin/omnidat-app <<WRAPPER
              #!${pkgs.runtimeShell}
              cd $out/share/omnidat-app
              exec ${pkgs.nodejs_24}/bin/node apps/nextjs/server.js
              WRAPPER
              chmod +x $out/bin/omnidat-app

              runHook postInstall
            '';

            meta.mainProgram = "omnidat-app";
          });
        });

      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_24
              pkgs.pnpm_10
              pkgs.postgresql_16
              pkgs.git
            ]
            ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
              pkgs.docker
              pkgs.docker-compose
            ];

            shellHook = ''
              echo "ForgeGraph-oriented development shell"
              echo "Run: pnpm install"
              echo "Run: docker compose up -d postgres"
              echo "Run: pnpm db:push"
            '';
          };
        });
    };
}
