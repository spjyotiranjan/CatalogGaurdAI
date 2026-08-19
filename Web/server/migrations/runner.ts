import "server-only";

import type { Db } from "mongodb";

import { databaseMigrations } from "@/server/migrations";
import type { DatabaseMigration } from "@/server/migrations/types";
import { logger } from "@/server/observability/logger";

export async function runDatabaseMigrations(
  database: Db,
  migrations: readonly DatabaseMigration[] = databaseMigrations,
): Promise<void> {
  const history = database.collection("_schema_migrations");
  await history.createIndex({ id: 1 }, { unique: true, name: "migration_id_unique" });

  for (const migration of migrations) {
    const applied = await history.findOne({ id: migration.id });
    if (applied) {
      logger.info("Database migration already applied", {
        operation: "database.migrate",
        outcomeCode: "SKIPPED",
        migrationId: migration.id,
      });
      continue;
    }

    await migration.up(database);
    await history.insertOne({
      id: migration.id,
      description: migration.description,
      appliedAt: new Date(),
      applicationVersion: process.env.CATALOGGUARD_APP_VERSION ?? "unknown",
    });
    logger.info("Database migration applied", {
      operation: "database.migrate",
      outcomeCode: "APPLIED",
      migrationId: migration.id,
    });
  }
}
