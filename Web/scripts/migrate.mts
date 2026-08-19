import mongoose from "mongoose";

import { connectToDatabase, disconnectFromDatabase } from "@/server/db/mongoose";
import { runDatabaseMigrations } from "@/server/migrations/runner";
import { logger } from "@/server/observability/logger";

async function migrate(): Promise<void> {
  const connection = await connectToDatabase();
  const database = connection.connection.db;
  if (!database) {
    throw new Error("MongoDB connection does not expose a database");
  }

  await runDatabaseMigrations(database);
}

export async function runMigrationCommand(): Promise<void> {
  try {
    await migrate();
  } catch (error) {
    logger.error("Database migration failed", {
      operation: "database.migrate",
      outcomeCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    });
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await disconnectFromDatabase();
    }
  }
}
