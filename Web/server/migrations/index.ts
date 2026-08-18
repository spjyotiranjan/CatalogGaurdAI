import "server-only";

import { phaseOneFoundationMigration } from "@/server/migrations/001-phase-one-foundation";
import type { DatabaseMigration } from "@/server/migrations/types";

export const databaseMigrations: readonly DatabaseMigration[] = [
  phaseOneFoundationMigration,
];
