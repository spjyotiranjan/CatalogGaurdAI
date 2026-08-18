import { z } from "zod";

export const errorCodeSchema = z.enum([
  "AUTHENTICATION_REQUIRED",
  "INVALID_CREDENTIALS",
  "SESSION_INACTIVE",
  "AUTHORIZATION_DENIED",
  "TENANT_SCOPE_DENIED",
  "VALIDATION_FAILED",
  "RATE_LIMITED",
  "CONFLICT",
  "DEPENDENCY_UNAVAILABLE",
  "SERVICE_AUTHENTICATION_FAILED",
  "SERVICE_MESSAGE_STALE",
  "SERVICE_MESSAGE_REPLAYED",
  "ACTOR_IDENTITY_MISMATCH",
  "JOB_CONTRACT_INVALID",
  "CORRELATION_ID_MISMATCH",
  "INTERNAL_ERROR",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const fieldErrorsSchema = z.record(z.string(), z.array(z.string())).optional();

export const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: errorCodeSchema,
        message: z.string().min(1),
        correlationId: z.uuid(),
        retryable: z.boolean(),
        fieldErrors: fieldErrorsSchema,
      })
      .strict(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

type AppErrorOptions = {
  code: ErrorCode;
  message: string;
  status: number;
  retryable?: boolean;
  fieldErrors?: Record<string, string[]>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.fieldErrors = options.fieldErrors;
  }
}

