import "server-only";

import { getEnvironment } from "@/server/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogValue = boolean | number | string | null | undefined;

export type LogContext = {
  correlationId?: string;
  operation?: string;
  outcomeCode?: string;
  durationMs?: number;
  actorType?: "USER" | "SYSTEM" | "AI";
  sellerId?: string | null;
  userId?: string | null;
  [key: string]: LogValue;
};

const sensitiveKeyPattern =
  /authorization|cookie|password|secret|token|prompt|storage|rawpayload|connection|string|uri/i;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function sanitizedContext(context: LogContext): Record<string, LogValue> {
  return Object.fromEntries(
    Object.entries(context)
      .filter(([key, value]) => value !== undefined && !sensitiveKeyPattern.test(key))
      .map(([key, value]) => [key, value]),
  );
}

function shouldLog(level: LogLevel, configuredLevel: string): boolean {
  if (configuredLevel === "silent") {
    return false;
  }
  return levelPriority[level] >= levelPriority[configuredLevel as LogLevel];
}

export function log(level: LogLevel, message: string, context: LogContext = {}): void {
  const environment = getEnvironment();
  if (!shouldLog(level, environment.LOG_LEVEL)) {
    return;
  }

  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    service: environment.CATALOGGUARD_SERVICE_NAME,
    environment: environment.CATALOGGUARD_ENVIRONMENT,
    ...sanitizedContext(context),
  });

  if (level === "error") {
    console.error(record);
  } else if (level === "warn") {
    console.warn(record);
  } else if (level === "debug") {
    console.debug(record);
  } else {
    console.info(record);
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    log("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    log("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    log("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    log("error", message, context);
  },
};

