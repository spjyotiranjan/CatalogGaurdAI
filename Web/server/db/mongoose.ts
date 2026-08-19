import "server-only";

import { getServers, setServers } from "node:dns";

import mongoose from "mongoose";

import { getEnvironment } from "@/server/config/env";

type ConnectionCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

export type DatabaseReadiness =
  | { ready: true }
  | {
      ready: false;
      diagnostic: {
        errorCode: string;
        errorCodeName: string;
        errorName: string;
        message: string;
        resolverServers: string;
      };
    };

type DatabaseDiagnostic = Extract<DatabaseReadiness, { ready: false }>["diagnostic"];

declare global {
  var catalogguardMongoose: ConnectionCache | undefined;
}

const cache = global.catalogguardMongoose ?? {
  connection: null,
  promise: null,
};

global.catalogguardMongoose = cache;

function configureMongoDnsResolver(
  uri: string,
  dnsServers: readonly string[] | undefined,
): void {
  if (uri.startsWith("mongodb+srv://") && dnsServers?.length) {
    setServers([...dnsServers]);
  }
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.connection && mongoose.connection.readyState === 1) {
    return cache.connection;
  }

  if (!cache.promise) {
    const environment = getEnvironment();
    configureMongoDnsResolver(
      environment.MONGODB_URI,
      environment.MONGODB_DNS_SERVERS,
    );
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

function databaseDiagnostic(error: unknown): DatabaseDiagnostic {
  const candidate = error instanceof Error ? error : undefined;
  const errorRecord = typeof error === "object" && error ? error : undefined;
  const causeRecord =
    typeof candidate?.cause === "object" && candidate.cause
      ? candidate.cause
      : undefined;
  const rawCode =
    errorRecord && "code" in errorRecord
      ? errorRecord.code
      : causeRecord && "code" in causeRecord
        ? causeRecord.code
        : undefined;
  const code =
    typeof rawCode === "string" || typeof rawCode === "number"
      ? String(rawCode)
      : "UNKNOWN";
  const rawCodeName =
    errorRecord && "codeName" in errorRecord
      ? errorRecord.codeName
      : causeRecord && "codeName" in causeRecord
        ? causeRecord.codeName
        : undefined;
  const codeName = typeof rawCodeName === "string" ? rawCodeName : "UNKNOWN";

  const message = {
    ECONNREFUSED: "The MongoDB SRV DNS query was refused by the configured Node.js DNS resolver.",
    ENOTFOUND: "The MongoDB host could not be resolved by the configured DNS resolver.",
    ETIMEDOUT: "The MongoDB connection timed out before a server was selected.",
    ECONNRESET: "The MongoDB connection was reset before readiness could be confirmed.",
    AUTHENTICATION_FAILED: "MongoDB rejected the configured database credentials.",
    "18": "MongoDB rejected the configured database credentials.",
    "8000": "MongoDB rejected the configured database credentials.",
  }[code] ?? "MongoDB did not accept a readiness ping.";

  return {
    errorCode: code,
    errorCodeName: codeName,
    errorName: candidate?.name ?? "UnknownError",
    message,
    resolverServers: getServers().join(",") || "system-default",
  };
}

export async function checkDatabaseReadiness(): Promise<DatabaseReadiness> {
  try {
    const database = await connectToDatabase();
    await database.connection.db?.admin().ping();
    return database.connection.readyState === 1
      ? { ready: true }
      : { ready: false, diagnostic: { errorCode: "NOT_CONNECTED", errorCodeName: "UNKNOWN", errorName: "MongooseConnectionState", message: "MongoDB did not enter the connected state after the readiness ping.", resolverServers: getServers().join(",") || "system-default" } };
  } catch (error) {
    return { ready: false, diagnostic: databaseDiagnostic(error) };
  }
}
