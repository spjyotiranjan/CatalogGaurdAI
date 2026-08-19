import "server-only";

import { z } from "zod";

const booleanFromEnvironment = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const integerFromEnvironment = (minimum: number, maximum: number) =>
  z.coerce.number().int().min(minimum).max(maximum);

const ipv4Address = z.string().refine(
  (value) => {
    const octets = value.split(".");
    return (
      octets.length === 4 &&
      octets.every(
        (octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255,
      )
    );
  },
  "Must be an IPv4 address",
);

const dnsServersFromEnvironment = z
  .string()
  .trim()
  .transform((value) => value.split(",").map((server) => server.trim()))
  .pipe(
    z
      .array(ipv4Address)
      .min(1)
      .max(4),
  )
  .optional();

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
    MONGODB_DNS_SERVERS: dnsServersFromEnvironment,
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
    BOOTSTRAP_ADMIN_SECRET: z.string().min(32).optional(),
    ORCHESTRATION_BASE_URL: z.url(),
    ORCHESTRATION_WEB_SERVICE_ID: z.string().trim().min(3).max(80),
    ORCHESTRATION_WEB_SERVICE_KEY_VERSION: z.string().trim().min(1).max(40),
    ORCHESTRATION_WEB_SERVICE_SECRET: z.string().min(32).optional(),
    ORCHESTRATION_CALLBACK_SERVICE_ID: z.string().trim().min(3).max(80),
    ORCHESTRATION_CALLBACK_KEY_VERSION: z.string().trim().min(1).max(40),
    ORCHESTRATION_CALLBACK_SIGNING_SECRET: z.string().min(32).optional(),
    ORCHESTRATION_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS: integerFromEnvironment(30, 900),
    ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS: integerFromEnvironment(60, 3_600),
    R2_ACCOUNT_ID: z.string().trim().min(1).optional(),
    R2_ENDPOINT: z.url().optional(),
    R2_BUCKET_NAME: z.string().trim().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/).optional(),
    R2_ACCESS_KEY_ID: z.string().trim().min(16).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(32).optional(),
    R2_MAX_UPLOAD_BYTES: integerFromEnvironment(1_024, 26_214_400),
    R2_DOWNLOAD_URL_TTL_SECONDS: integerFromEnvironment(30, 900),
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

    if (value.ORCHESTRATION_WEB_SERVICE_ID === value.ORCHESTRATION_CALLBACK_SERVICE_ID) {
      context.addIssue({
        code: "custom",
        path: ["ORCHESTRATION_CALLBACK_SERVICE_ID"],
        message: "Web intake and Orchestration callback service IDs must differ",
      });
    }
    if (value.ORCHESTRATION_WEB_SERVICE_SECRET && value.ORCHESTRATION_CALLBACK_SIGNING_SECRET && value.ORCHESTRATION_WEB_SERVICE_SECRET === value.ORCHESTRATION_CALLBACK_SIGNING_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["ORCHESTRATION_CALLBACK_SIGNING_SECRET"],
        message: "Web intake and Orchestration callback secrets must differ",
      });
    }
    if (value.ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS < value.ORCHESTRATION_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS * 2) {
      context.addIssue({
        code: "custom",
        path: ["ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS"],
        message: "Must cover both sides of the accepted clock-skew window",
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

const orchestrationBridgeEnvironmentSchema = z
  .object({
    ORCHESTRATION_BASE_URL: z.url(),
    ORCHESTRATION_WEB_SERVICE_ID: z.string().trim().min(3).max(80),
    ORCHESTRATION_WEB_SERVICE_KEY_VERSION: z.string().trim().min(1).max(40),
    ORCHESTRATION_WEB_SERVICE_SECRET: z.string().min(32),
    ORCHESTRATION_CALLBACK_SERVICE_ID: z.string().trim().min(3).max(80),
    ORCHESTRATION_CALLBACK_KEY_VERSION: z.string().trim().min(1).max(40),
    ORCHESTRATION_CALLBACK_SIGNING_SECRET: z.string().min(32),
    ORCHESTRATION_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS: integerFromEnvironment(30, 900),
    ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS: integerFromEnvironment(60, 3_600),
  })
  .strict();

export type OrchestrationBridgeEnvironment = z.infer<typeof orchestrationBridgeEnvironmentSchema>;

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
    MONGODB_DNS_SERVERS: process.env.MONGODB_DNS_SERVERS,
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
    BOOTSTRAP_ADMIN_SECRET: process.env.BOOTSTRAP_ADMIN_SECRET,
    ORCHESTRATION_BASE_URL: process.env.ORCHESTRATION_BASE_URL ?? "http://localhost:8000",
    ORCHESTRATION_WEB_SERVICE_ID: process.env.ORCHESTRATION_WEB_SERVICE_ID ?? "web-bff",
    ORCHESTRATION_WEB_SERVICE_KEY_VERSION: process.env.ORCHESTRATION_WEB_SERVICE_KEY_VERSION ?? "web-k1",
    ORCHESTRATION_WEB_SERVICE_SECRET: process.env.ORCHESTRATION_WEB_SERVICE_SECRET,
    ORCHESTRATION_CALLBACK_SERVICE_ID: process.env.ORCHESTRATION_CALLBACK_SERVICE_ID ?? "validation-orchestrator",
    ORCHESTRATION_CALLBACK_KEY_VERSION: process.env.ORCHESTRATION_CALLBACK_KEY_VERSION ?? "orchestration-k1",
    ORCHESTRATION_CALLBACK_SIGNING_SECRET: process.env.ORCHESTRATION_CALLBACK_SIGNING_SECRET,
    ORCHESTRATION_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS: process.env.ORCHESTRATION_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS ?? "300",
    ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS: process.env.ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS ?? "900",
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_MAX_UPLOAD_BYTES: process.env.R2_MAX_UPLOAD_BYTES ?? "10485760",
    R2_DOWNLOAD_URL_TTL_SECONDS: process.env.R2_DOWNLOAD_URL_TTL_SECONDS ?? "300",
  };
}

export type FeedStorageEnvironment = {
  R2_ACCOUNT_ID: string; R2_ENDPOINT: string; R2_BUCKET_NAME: string; R2_ACCESS_KEY_ID: string; R2_SECRET_ACCESS_KEY: string;
  R2_MAX_UPLOAD_BYTES: number; R2_DOWNLOAD_URL_TTL_SECONDS: number;
};

export function getFeedStorageEnvironment(): FeedStorageEnvironment | null {
  const environment = getEnvironment();
  const values = [environment.R2_ACCOUNT_ID, environment.R2_ENDPOINT, environment.R2_BUCKET_NAME, environment.R2_ACCESS_KEY_ID, environment.R2_SECRET_ACCESS_KEY];
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) throw new Error("Cloudflare R2 configuration is incomplete.");
  return { R2_ACCOUNT_ID: environment.R2_ACCOUNT_ID!, R2_ENDPOINT: environment.R2_ENDPOINT!, R2_BUCKET_NAME: environment.R2_BUCKET_NAME!, R2_ACCESS_KEY_ID: environment.R2_ACCESS_KEY_ID!, R2_SECRET_ACCESS_KEY: environment.R2_SECRET_ACCESS_KEY!, R2_MAX_UPLOAD_BYTES: environment.R2_MAX_UPLOAD_BYTES, R2_DOWNLOAD_URL_TTL_SECONDS: environment.R2_DOWNLOAD_URL_TTL_SECONDS };
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

export function getOrchestrationBridgeEnvironment(): OrchestrationBridgeEnvironment | null {
  const environment = getEnvironment();
  if (!environment.ORCHESTRATION_WEB_SERVICE_SECRET || !environment.ORCHESTRATION_CALLBACK_SIGNING_SECRET) {
    return null;
  }
  return orchestrationBridgeEnvironmentSchema.parse({
    ORCHESTRATION_BASE_URL: environment.ORCHESTRATION_BASE_URL,
    ORCHESTRATION_WEB_SERVICE_ID: environment.ORCHESTRATION_WEB_SERVICE_ID,
    ORCHESTRATION_WEB_SERVICE_KEY_VERSION: environment.ORCHESTRATION_WEB_SERVICE_KEY_VERSION,
    ORCHESTRATION_WEB_SERVICE_SECRET: environment.ORCHESTRATION_WEB_SERVICE_SECRET,
    ORCHESTRATION_CALLBACK_SERVICE_ID: environment.ORCHESTRATION_CALLBACK_SERVICE_ID,
    ORCHESTRATION_CALLBACK_KEY_VERSION: environment.ORCHESTRATION_CALLBACK_KEY_VERSION,
    ORCHESTRATION_CALLBACK_SIGNING_SECRET: environment.ORCHESTRATION_CALLBACK_SIGNING_SECRET,
    ORCHESTRATION_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS: environment.ORCHESTRATION_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS,
    ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS: environment.ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS,
  });
}

export function resetEnvironmentForTests(): void {
  if (process.env.CATALOGGUARD_ENVIRONMENT !== "test") {
    throw new Error("Environment cache can only be reset in tests");
  }
  cachedEnvironment = undefined;
}
