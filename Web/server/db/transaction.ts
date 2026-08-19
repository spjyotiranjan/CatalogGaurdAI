import "server-only";

import type { ClientSession } from "mongoose";

import { connectToDatabase } from "@/server/db/mongoose";

export async function withMongoTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const database = await connectToDatabase();
  const session = await database.startSession();

  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });

    if (result === undefined) {
      throw new Error("MongoDB transaction completed without a result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}
