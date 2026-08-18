import "server-only";

import type { DatabaseMigration } from "@/server/migrations/types";

export const accessRequestDismissalsMigration: DatabaseMigration = {
  id: "003-access-request-dismissals",
  description: "Add per-administrator access request dismissal index",
  async up(database) {
    await database.collection("access_requests").createIndex(
      { dismissedByUserIds: 1, status: 1 },
      { name: "access_request_dismissed_status" },
    );
  },
};
