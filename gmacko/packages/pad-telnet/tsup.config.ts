import { defineConfig } from "tsup";

// Bundle @omnidat/operator-core (whose subpath exports resolve to raw .ts) into
// the daemon so `node dist/index.js` runs standalone on a node with no workspace
// or TS toolchain present.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  noExternal: [/@omnidat\//],
  clean: true,
});
