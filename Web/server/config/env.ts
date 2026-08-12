import "server-only";

import { z } from "zod";

const booleanFromEnvironment = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const integerFromEnvironment = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);

const environmentSchema = z
  .object({
    CATALOGGUARD_ENVIRONMENT: z.enum(["development", "test", "staging", "production"]),
    CATALOGGUARD_SERVICE_NAME: z.string().trim().min(1).max(80),
    CATALOGGUARD_APP_VERSION: z.string().trim().min(1).max(80),
    MONGODB_URI: z
      .string()
      .trim()
      .refine(
        (value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
        "Must be a MongoDB connection string",
      ),
    MONGODB_DB_NAME: z.string().trim().regex(/^[A-Za-z0-9_-]{1,63}$/),
    MONGODB_CONNECT_TIMEOUT_MS: integerFromEnvironment(500, 60_000),
    MONGODB_MAX_POOL_SIZE: integerFromEnvironment(1, 100),
    AUTH_SECRET: z.string().min(32),
    AUTH_URL: z.url().refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      "Must use the http or https protocol",
    ),
    AUTH_TRUST_HOST: booleanFromEnvironment,
    SESSION_MAX_AGE_SECONDS: integerFromEnvironment(300, 2_592_000),
    SESSION_UPDATE_AGE_SECONDS: integerFromEnvironment(60, 604_800),
    LOGIN_RATE_LIMIT_WINDOW_MS: integerFromEnvironment(1_000, 3_600_000),
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: integerFromEnvironment(1, 100),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]),
    API_DOCS_ENABLED: booleanFromEnvironment,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.SESSION_UPDATE_AGE_SECONDS >= value.SESSION_MAX_AGE_SECONDS) {
      context.addIssue({
        code: "custom",
        path: ["SESSION_UPDATE_AGE_SECONDS"],
        message: "Must be less than SESSION_MAX_AGE_SECONDS",
      });
    }

    if (
      (value.CATALOGGUARD_ENVIRONMENT === "staging" ||
        value.CATALOGGUARD_ENVIRONMENT === "production") &&
      !value.AUTH_URL.startsWith("https://")
    ) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_URL"],
        message: "Must use https in staging and production",
      });
    }

    if (!value.AUTH_TRUST_HOST) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_TRUST_HOST"],
        message: "Auth.js requires trusted host handling; set this to true with AUTH_URL configured",
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

let cachedEnvironment: Environment | undefined;

function rawEnvironment() {
  const catalogguardEnvironment =
    process.env.CATALOGGUARD_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
  return {
    CATALOGGUARD_ENVIRONMENT: catalogguardEnvironment,
    CATALOGGUARD_SERVICE_NAME: process.env.CATALOGGUARD_SERVICE_NAME ?? "catalogguard-web",
    CATALOGGUARD_APP_VERSION: process.env.CATALOGGUARD_APP_VERSION ?? "0.1.0",
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME ?? "catalogguard",
    MONGODB_CONNECT_TIMEOUT_MS: process.env.MONGODB_CONNECT_TIMEOUT_MS ?? "5000",
    MONGODB_MAX_POOL_SIZE: process.env.MONGODB_MAX_POOL_SIZE ?? "10",
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "true",
    SESSION_MAX_AGE_SECONDS: process.env.SESSION_MAX_AGE_SECONDS ?? "28800",
    SESSION_UPDATE_AGE_SECONDS: process.env.SESSION_UPDATE_AGE_SECONDS ?? "3600",
    LOGIN_RATE_LIMIT_WINDOW_MS: process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? "900000",
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? "10",
    LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
    API_DOCS_ENABLED:
      process.env.API_DOCS_ENABLED ??
      (catalogguardEnvironment === "production" ? "false" : "true"),
  };
}

export function getEnvironment(): Environment {
  if (!cachedEnvironment) {
    cachedEnvironment = environmentSchema.parse(rawEnvironment());
  }

  return cachedEnvironment;
}

export function validateEnvironment(): void {
  getEnvironment();
}

export function resetEnvironmentForTests(): void {
  if (process.env.CATALOGGUARD_ENVIRONMENT !== "test") {
    throw new Error("Environment cache can only be reset in tests");
  }
  cachedEnvironment = undefined;
}
