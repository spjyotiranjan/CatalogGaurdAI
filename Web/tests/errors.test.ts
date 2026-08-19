import { describe, expect, it } from "vitest";

import { AppError, errorEnvelopeSchema } from "@/lib/contracts/errors";
import { errorResponse } from "@/server/errors/responses";

const correlationId = "4f864f99-aa42-49f5-93cd-77369c20f213";

describe("client-safe error responses", () => {
  it("returns a stable envelope for an expected error", async () => {
    const response = errorResponse(
      new AppError({
        code: "AUTHORIZATION_DENIED",
        message: "You are not authorized.",
        status: 403,
        details: { dependency: "mongodb", errorCode: "ECONNREFUSED" },
      }),
      correlationId,
      "test.operation",
    );
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(errorEnvelopeSchema.parse(body).error).toMatchObject({
      code: "AUTHORIZATION_DENIED",
      correlationId,
      retryable: false,
      details: { dependency: "mongodb", errorCode: "ECONNREFUSED" },
    });
  });

  it("does not expose unexpected error details", async () => {
    const response = errorResponse(
      new Error("password=do-not-expose"),
      correlationId,
      "test.operation",
    );
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("do-not-expose");
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("classifies malformed JSON as a validation error", async () => {
    const response = errorResponse(
      new SyntaxError("Unexpected token"),
      correlationId,
      "test.operation",
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });
});
