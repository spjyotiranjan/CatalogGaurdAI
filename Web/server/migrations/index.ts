import "server-only";

import { phaseOneFoundationMigration } from "@/server/migrations/001-phase-one-foundation";
import { accessRequestsMigration } from "@/server/migrations/002-access-requests";
import { accessRequestDismissalsMigration } from "@/server/migrations/003-access-request-dismissals";
import type { DatabaseMigration } from "@/server/migrations/types";

export const databaseMigrations: readonly DatabaseMigration[] = [
  phaseOneFoundationMigration,
  accessRequestsMigration,
  accessRequestDismissalsMigration,
];
