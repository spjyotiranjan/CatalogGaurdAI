import "server-only";

import type { Db } from "mongodb";

export type DatabaseMigration = {
  id: string;
  description: string;
  up(database: Db): Promise<void>;
};
