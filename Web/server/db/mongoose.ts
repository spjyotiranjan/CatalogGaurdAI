import "server-only";

import mongoose from "mongoose";

import { getEnvironment } from "@/server/config/env";

type ConnectionCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var catalogguardMongoose: ConnectionCache | undefined;
}

const cache = global.catalogguardMongoose ?? {
  connection: null,
  promise: null,
};

global.catalogguardMongoose = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.connection && mongoose.connection.readyState === 1) {
    return cache.connection;
  }

  if (!cache.promise) {
    const environment = getEnvironment();
    cache.promise = mongoose
      .connect(environment.MONGODB_URI, {
        dbName: environment.MONGODB_DB_NAME,
        autoCreate: false,
        autoIndex: false,
        maxPoolSize: environment.MONGODB_MAX_POOL_SIZE,
        serverSelectionTimeoutMS: environment.MONGODB_CONNECT_TIMEOUT_MS,
      })
      .catch((error) => {
        cache.promise = null;
        throw error;
      });
  }

  cache.connection = await cache.promise;
  return cache.connection;
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
  cache.connection = null;
  cache.promise = null;
}

export async function checkDatabaseReadiness(): Promise<boolean> {
  try {
    const database = await connectToDatabase();
    await database.connection.db?.admin().ping();
    return database.connection.readyState === 1;
  } catch {
    return false;
  }
}
