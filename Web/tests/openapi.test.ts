import { describe, expect, it } from "vitest";

import { GET as getOpenApi } from "@/app/api/openapi.json/route";
import {
  resetEnvironmentForTests,
} from "@/server/config/env";
import { createOpenApiDocument } from "@/server/openapi/document";

const expectedPaths = [
  "/api/access-requests",
  "/api/account",
  "/api/account/password",
  "/api/admin/access-requests",
  "/api/admin/access-requests/{id}/approve",
  "/api/admin/access-requests/{id}/dismiss",
  "/api/admin/access-requests/{id}/revoke",
  "/api/auth/callback/credentials",
  "/api/auth/csrf",
  "/api/auth/error",
  "/api/auth/providers",
  "/api/auth/session",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/docs",
  "/api/feeds",
  "/api/feeds/{id}",
  "/api/feeds/{id}/download",
  "/api/health",
  "/api/internal/bootstrap/admin",
  "/api/internal/validation-results",
  "/api/openapi.json",
  "/api/ready",
];

describe("Web OpenAPI documentation", () => {
  it("documents every implemented Phase 1 operation with descriptions and responses", () => {
    const document = createOpenApiDocument();
    const operationIds: string[] = [];

    expect(document.openapi).toBe("3.1.0");
    expect(Object.keys(document.paths).sort()).toEqual(expectedPaths);
    for (const pathItem of Object.values(document.paths)) {
      for (const operation of Object.values(pathItem)) {
        expect(operation.operationId).toEqual(expect.any(String));
        operationIds.push(operation.operationId as string);
        expect(operation.summary).toEqual(expect.any(String));
        expect(operation.description).toEqual(expect.any(String));
        expect(operation.responses).toBeDefined();
      }
    }
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("derives strict component models from the runtime Zod contracts", () => {
    const schemas = createOpenApiDocument().components.schemas;

    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining([
        "AccountResponse",
        "AccessRequestDecision",
        "AccessRequestList",
        "AccessRequestSubmission",
        "AuthProvidersResponse",
        "AuthSessionResponse",
        "CredentialsCallbackRequest",
        "ErrorEnvelope",
        "HealthResponse",
        "PasswordChangeRequest",
        "ReadinessResponse",
        "CreateAccessRequest",
        "BootstrapAdmin",
        "ValidationJobResultV1",
        "CreateFeedResponse",
        "FeedListResponse",
        "FeedDetailResponse",
        "FeedDownloadResponse",
      ]),
    );
    expect(schemas.AccountResponse.additionalProperties).toBe(false);
    expect(schemas.PasswordChangeRequest.additionalProperties).toBe(false);
  });

  it("documents session and same-origin security on protected account operations", () => {
    const paths = createOpenApiDocument().paths;

    expect(paths["/api/account"].get.security).toEqual([{ authSessionCookie: [] }]);
    expect(paths["/api/account/password"].patch.security).toEqual([
      { authSessionCookie: [] },
    ]);
    expect(paths["/api/account/password"].patch.requestBody).toBeDefined();
    expect(paths["/api/admin/access-requests"].get.security).toEqual([
      { authSessionCookie: [] },
    ]);
    expect(paths["/api/admin/access-requests/{id}/approve"].post.security).toEqual([
      { authSessionCookie: [] },
    ]);
  });

  it("serves the generated document when documentation is enabled", async () => {
    const response = getOpenApi();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ openapi: "3.1.0" });
  });

  it("does not expose the document when documentation is disabled", () => {
    resetEnvironmentForTests();
    process.env.API_DOCS_ENABLED = "false";
    try {
      expect(getOpenApi().status).toBe(404);
    } finally {
      process.env.API_DOCS_ENABLED = "true";
      resetEnvironmentForTests();
    }
  });
});
