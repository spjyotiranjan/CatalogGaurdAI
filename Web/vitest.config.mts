import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const serverOnlyStub = fileURLToPath(
  new URL("./tests/stubs/server-only.ts", import.meta.url),
);
const mongoBinaryCache = fileURLToPath(
  new URL("./.cache/mongodb-binaries", import.meta.url),
);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": serverOnlyStub,
    },
  },
  test: {
    environment: "node",
    env: {
      MONGOMS_DOWNLOAD_DIR: mongoBinaryCache,
    },
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
