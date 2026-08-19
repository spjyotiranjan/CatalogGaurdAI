import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Next.js loads `.env.local` automatically, but this standalone Node runner
// does not. Load it before bundling so the migration process sees the same
// database and Auth.js configuration as the Web app.
const localEnvironmentFile = join(webRoot, ".env.local");
if (existsSync(localEnvironmentFile)) {
  loadEnvFile(localEnvironmentFile);
}

const buildDirectory = await mkdtemp(join(webRoot, ".migration-build-"));
const bundledMigration = join(buildDirectory, "migrate.cjs");

try {
  await build({
    absWorkingDir: webRoot,
    entryPoints: ["scripts/migrate.mts"],
    outfile: bundledMigration,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    packages: "external",
    sourcemap: "inline",
    logLevel: "silent",
    plugins: [
      {
        name: "server-only-stub",
        setup(esbuild) {
          esbuild.onResolve({ filter: /^server-only$/ }, () => ({
            path: "server-only",
            namespace: "catalogguard-stub",
          }));
          esbuild.onLoad(
            { filter: /.*/, namespace: "catalogguard-stub" },
            () => ({ contents: "export {};", loader: "js" }),
          );
        },
      },
    ],
  });

  const migrationModule = await import(
    `${pathToFileURL(bundledMigration).href}?run=${Date.now()}`
  );
  const runMigrationCommand =
    migrationModule.runMigrationCommand ??
    migrationModule.default?.runMigrationCommand;
  if (typeof runMigrationCommand !== "function") {
    throw new Error("Bundled migration did not export runMigrationCommand");
  }
  await runMigrationCommand();
} finally {
  await rm(buildDirectory, { recursive: true, force: true });
}
