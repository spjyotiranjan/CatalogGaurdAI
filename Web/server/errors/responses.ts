import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  AppError,
  type ErrorEnvelope,
} from "@/lib/contracts/errors";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { logger } from "@/server/observability/logger";

function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const flattened = error.flatten();
  return Object.fromEntries(
    Object.entries(flattened.fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );
}

export function errorResponse(
  error: unknown,
  correlationId: string,
  operation: string,
): NextResponse<ErrorEnvelope> {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new AppError({
      code: "VALIDATION_FAILED",
      message: "The request was invalid.",
      status: 400,
      fieldErrors: zodFieldErrors(error),
      cause: error,
    });
  } else if (error instanceof SyntaxError) {
    appError = new AppError({
      code: "VALIDATION_FAILED",
      message: "The request body was not valid JSON.",
      status: 400,
      cause: error,
    });
  } else {
    appError = new AppError({
      code: "INTERNAL_ERROR",
      message: "The operation could not be completed.",
      status: 500,
      retryable: true,
      cause: error,
    });
  }

  const logContext = {
    correlationId,
    operation,
    outcomeCode: appError.code,
    retryable: appError.retryable,
  };
  if (appError.status >= 500) {
    logger.error("Request failed", {
      ...logContext,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  } else {
    logger.warn("Request rejected", logContext);
  }

  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        correlationId,
        retryable: appError.retryable,
        ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
        ...(appError.details ? { details: appError.details } : {}),
      },
    },
    {
      status: appError.status,
      headers: {
        [CORRELATION_ID_HEADER]: correlationId,
        "cache-control": "no-store",
      },
    },
  );
}
