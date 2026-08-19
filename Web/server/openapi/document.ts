import "server-only";

import { z } from "zod";

import { accountResponseSchema } from "@/lib/contracts/account";
import {
  accessRequestListSchema,
  accessRequestSubmissionSchema,
  bootstrapAdminSchema,
  createAccessRequestSchema,
  decideAccessRequestSchema,
} from "@/lib/contracts/access-requests";
import {
  loginCredentialsSchema,
  passwordChangeSchema,
} from "@/lib/contracts/auth";
import { errorEnvelopeSchema } from "@/lib/contracts/errors";
import { validationJobResultSchema } from "@/lib/contracts/orchestration";
import { createFeedResponseSchema, feedDetailResponseSchema, feedDownloadResponseSchema, feedListResponseSchema } from "@/lib/contracts/feeds";
import {
  authProvidersResponseSchema,
  authSessionResponseSchema,
  csrfTokenResponseSchema,
  healthResponseSchema,
  readinessResponseSchema,
} from "@/lib/contracts/operations";
import { getEnvironment } from "@/server/config/env";

type JsonObject = Record<string, unknown>;

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: JsonObject;
  servers: JsonObject[];
  tags: JsonObject[];
  paths: Record<string, Record<string, JsonObject>>;
  components: {
    schemas: Record<string, JsonObject>;
    parameters: Record<string, JsonObject>;
    headers: Record<string, JsonObject>;
    securitySchemes: Record<string, JsonObject>;
  };
};

function componentSchema(schema: z.ZodType, io: "input" | "output" = "output"): JsonObject {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
  }) as JsonObject;
  delete jsonSchema.$schema;
  return inlineLocalDefinitions(jsonSchema);
}

/**
 * Swagger UI's current ApiDOM resolver does not resolve Zod's local recursive
 * `#/$defs/...` references when a schema is nested under components.schemas.
 *
 * The affected definition is produced by z.json(). For documentation, a
 * recursive reference encountered while inlining is represented by `{}` — the
 * OpenAPI schema for an arbitrary JSON value. Runtime Zod validation remains
 * strict and unchanged.
 */
function inlineLocalDefinitions(schema: JsonObject): JsonObject {
  const definitions = isJsonObject(schema.$defs) ? schema.$defs : {};
  const resolving = new Set<string>();

  const resolve = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(resolve);
    if (!isJsonObject(value)) return value;

    const reference = value.$ref;
    if (typeof reference === "string" && reference.startsWith("#/$defs/")) {
      const definitionName = reference.slice("#/$defs/".length);
      const definition = definitions[definitionName];
      const siblings = Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== "$ref")
          .map(([key, child]) => [key, resolve(child)]),
      );

      if (!isJsonObject(definition) || resolving.has(definitionName)) {
        return siblings;
      }

      resolving.add(definitionName);
      const resolvedDefinition = resolve(definition);
      resolving.delete(definitionName);
      return { ...(isJsonObject(resolvedDefinition) ? resolvedDefinition : {}), ...siblings };
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$defs")
        .map(([key, child]) => [key, resolve(child)]),
    );
  };

  return resolve(schema) as JsonObject;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const credentialsCallbackSchema = loginCredentialsSchema.extend({
  csrfToken: z.string().min(1),
  callbackUrl: z.url().optional(),
});

const signOutRequestSchema = z
  .object({
    csrfToken: z.string().min(1),
    callbackUrl: z.url().optional(),
  })
  .strict();

const correlationParameter = { $ref: "#/components/parameters/CorrelationId" };
const correlationHeader = { $ref: "#/components/headers/CorrelationId" };

function jsonContent(schemaName: string, example?: unknown): JsonObject {
  return {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schemaName}` },
      ...(example === undefined ? {} : { example }),
    },
  };
}

function successResponse(
  description: string,
  schemaName: string,
  example?: unknown,
): JsonObject {
  return {
    description,
    headers: { "X-Correlation-ID": correlationHeader },
    content: jsonContent(schemaName, example),
  };
}

function errorResponse(
  description: string,
  exampleCode: string,
  retryable = false,
): JsonObject {
  return {
    description,
    headers: { "X-Correlation-ID": correlationHeader },
    content: jsonContent("ErrorEnvelope", {
      error: {
        code: exampleCode,
        message: description,
        correlationId: "4f864f99-aa42-49f5-93cd-77369c20f213",
        retryable,
      },
    }),
  };
}

export function createOpenApiDocument(): OpenApiDocument {
  const environment = getEnvironment();
  return {
    openapi: "3.1.0",
    info: {
      title: "CatalogGuard Web Backend API",
      version: environment.CATALOGGUARD_APP_VERSION,
      summary: "Authenticated BFF and canonical catalog API",
      description:
        "Next.js backend-for-frontend for identity, tenant authorization, canonical MongoDB data, private R2 coordination, and the trusted Orchestration handoff. Browser callers never invoke FastAPI directly.",
      license: { name: "Proprietary" },
    },
    servers: [{ url: "/", description: "Current CatalogGuard Web deployment" }],
    tags: [
      { name: "Operations", description: "Liveness, dependency readiness, and API documentation." },
      { name: "Authentication", description: "Auth.js credential session lifecycle endpoints." },
      { name: "Account", description: "Authenticated account profile and credential maintenance." },
      { name: "Access Requests", description: "Public seller/reviewer proposals and administrator decisions." },
      { name: "Bootstrap", description: "One-time first-administrator provisioning." },
      { name: "Feeds", description: "Seller-scoped private CSV upload, status, and controlled download." },
      { name: "Internal integrations", description: "Authenticated service-to-service contracts; never invoked by a browser." },
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["Operations"],
          operationId: "getWebHealth",
          summary: "Check Web process liveness",
          description:
            "Returns process liveness without probing MongoDB or other dependencies. Safe for platform liveness checks.",
          parameters: [correlationParameter],
          responses: {
            "200": successResponse("The Web process is alive.", "HealthResponse", {
              status: "ok",
              service: "catalogguard-web",
              version: environment.CATALOGGUARD_APP_VERSION,
            }),
          },
        },
      },
      "/api/ready": {
        get: {
          tags: ["Operations"],
          operationId: "getWebReadiness",
          summary: "Check Web dependency readiness",
          description:
            "Checks the MongoDB dependency. A failure does not imply that the Web process is not alive.",
          parameters: [correlationParameter],
          responses: {
            "200": successResponse("Web and MongoDB are ready.", "ReadinessResponse", {
              status: "ready",
              service: "catalogguard-web",
              version: environment.CATALOGGUARD_APP_VERSION,
              dependencies: { mongodb: "ready" },
            }),
            "503": errorResponse(
              "MongoDB is unavailable. The response identifies the dependency and includes a safe diagnostic error code.",
              "DEPENDENCY_UNAVAILABLE",
              true,
            ),
          },
        },
      },
      "/api/auth/session": {
        get: {
          tags: ["Authentication"],
          operationId: "getAuthSession",
          summary: "Read the current Auth.js session",
          description:
            "Returns the active database-revalidated session or null. The session cookie is HttpOnly and is supplied by the browser.",
          parameters: [correlationParameter],
          responses: {
            "200": successResponse(
              "Current session, or null for an anonymous/inactive session.",
              "AuthSessionResponse",
              null,
            ),
          },
        },
      },
      "/api/auth/csrf": {
        get: {
          tags: ["Authentication"],
          operationId: "getAuthCsrfToken",
          summary: "Create an Auth.js CSRF token",
          description: "Returns the token required by Auth.js credential and sign-out form submissions.",
          parameters: [correlationParameter],
          responses: {
            "200": successResponse("CSRF token created.", "CsrfTokenResponse", {
              csrfToken: "safe-example-token",
            }),
          },
        },
      },
      "/api/auth/providers": {
        get: {
          tags: ["Authentication"],
          operationId: "getAuthProviders",
          summary: "List configured Auth.js providers",
          description:
            "Returns safe provider metadata. Phase 1 configures the credentials provider only.",
          parameters: [correlationParameter],
          responses: {
            "200": successResponse("Configured authentication providers.", "AuthProvidersResponse", {
              credentials: {
                id: "credentials",
                name: "Credentials",
                type: "credentials",
                signinUrl: "https://catalog.example/api/auth/signin/credentials",
                callbackUrl: "https://catalog.example/api/auth/callback/credentials",
              },
            }),
          },
        },
      },
      "/api/auth/signin": {
        get: {
          tags: ["Authentication"],
          operationId: "getAuthSignIn",
          summary: "Open the Auth.js sign-in entrypoint",
          description: "Returns or redirects to the configured Auth.js credentials sign-in flow.",
          parameters: [
            correlationParameter,
            {
              name: "callbackUrl",
              in: "query",
              required: false,
              description: "Validated post-authentication return URL.",
              schema: { type: "string", format: "uri" },
            },
          ],
          responses: {
            "200": { description: "Auth.js sign-in HTML.", content: { "text/html": {} } },
            "302": { description: "Redirect to the configured sign-in page." },
          },
        },
      },
      "/api/auth/error": {
        get: {
          tags: ["Authentication"],
          operationId: "getAuthError",
          summary: "Open the Auth.js safe error page",
          description:
            "Returns the framework error experience without exposing credential or provider internals.",
          parameters: [
            correlationParameter,
            {
              name: "error",
              in: "query",
              required: false,
              description: "Safe Auth.js error classification.",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Auth.js error HTML.", content: { "text/html": {} } },
          },
        },
      },
      "/api/auth/callback/credentials": {
        post: {
          tags: ["Authentication"],
          operationId: "submitCredentialSignIn",
          summary: "Submit Auth.js credentials",
          description:
            "Auth.js credential callback. Obtain a CSRF token first. Failures intentionally do not reveal whether an email exists.",
          parameters: [correlationParameter],
          requestBody: {
            required: true,
            content: {
              "application/x-www-form-urlencoded": {
                schema: { $ref: "#/components/schemas/CredentialsCallbackRequest" },
              },
            },
          },
          responses: {
            "302": {
              description: "Auth.js redirects after successful or failed credential processing.",
              headers: {
                Location: { description: "Safe Auth.js redirect target.", schema: { type: "string" } },
                "X-Correlation-ID": correlationHeader,
              },
            },
          },
        },
      },
      "/api/auth/signout": {
        post: {
          tags: ["Authentication"],
          operationId: "signOutAuthSession",
          summary: "End the current Auth.js session",
          description: "Ends the current session after Auth.js CSRF validation and records an audit event.",
          parameters: [correlationParameter],
          security: [{ authSessionCookie: [] }],
          requestBody: {
            required: true,
            content: {
              "application/x-www-form-urlencoded": {
                schema: { $ref: "#/components/schemas/SignOutRequest" },
              },
            },
          },
          responses: {
            "302": {
              description: "Auth.js redirects after session termination.",
              headers: {
                Location: { description: "Safe Auth.js redirect target.", schema: { type: "string" } },
                "X-Correlation-ID": correlationHeader,
              },
            },
          },
        },
      },
      "/api/account": {
        get: {
          tags: ["Account"],
          operationId: "getCurrentAccount",
          summary: "Read the active account",
          description:
            "Reloads the active user from MongoDB and returns a safe account projection. Role and seller scope are never trusted from browser state.",
          parameters: [correlationParameter],
          security: [{ authSessionCookie: [] }],
          responses: {
            "200": successResponse("Current active account.", "AccountResponse", {
              data: {
                id: "66bb4f8b683bb83a83c26110",
                sellerId: "66bb4f8b683bb83a83c26111",
                fullName: "Example Seller Operator",
                email: "operator@example.test",
                role: "SELLER_OPERATOR",
                status: "ACTIVE",
              },
            }),
            "401": errorResponse("Authentication is required or the session is inactive.", "AUTHENTICATION_REQUIRED"),
            "403": errorResponse("The account has an invalid authorization scope.", "AUTHORIZATION_DENIED"),
            "500": errorResponse("The account could not be read.", "INTERNAL_ERROR", true),
          },
        },
      },
      "/api/account/password": {
        patch: {
          tags: ["Account"],
          operationId: "changeCurrentAccountPassword",
          summary: "Change the active account password",
          description:
            "Requires a verified session and same-origin request. Rechecks the current password, writes a bcrypt hash, and appends the audit event in one transaction.",
          parameters: [
            correlationParameter,
            {
              name: "Origin",
              in: "header",
              required: true,
              description: "Must match the configured canonical Auth.js origin.",
              schema: { type: "string", format: "uri" },
            },
          ],
          security: [{ authSessionCookie: [] }],
          requestBody: {
            required: true,
            content: jsonContent("PasswordChangeRequest", {
              currentPassword: "Current-password-example-only",
              newPassword: "Replacement-password-example-only!1",
            }),
          },
          responses: {
            "204": {
              description: "Password changed and audit event committed. No response body.",
              headers: { "X-Correlation-ID": correlationHeader },
            },
            "400": errorResponse(
              "The body is invalid, the current password is wrong, or the replacement is unchanged.",
              "INVALID_CREDENTIALS",
            ),
            "401": errorResponse("Authentication is required.", "AUTHENTICATION_REQUIRED"),
            "403": errorResponse("The request origin or account scope is not allowed.", "AUTHORIZATION_DENIED"),
            "409": errorResponse(
              "The password could not be updated because the account changed concurrently.",
              "CONFLICT",
              true,
            ),
            "500": errorResponse(
              "The password change could not be committed.",
              "INTERNAL_ERROR",
              true,
            ),
          },
        },
      },
      "/api/access-requests": {
        post: {
          tags: ["Access Requests"], operationId: "submitAccessRequest", summary: "Submit a seller or reviewer access request",
          description: "Creates a pending proposal with a bcrypt-hashed credential. Submission never creates an active account.",
          parameters: [correlationParameter],
          requestBody: { required: true, content: jsonContent("CreateAccessRequest", { role: "CATALOG_REVIEWER", fullName: "Example Reviewer", email: "reviewer@example.test", password: "Example-strong-password!1", proposal: "I have experience reviewing marketplace catalog data and validation findings." }) },
          responses: {
            "201": successResponse("Access request submitted for administrator review.", "AccessRequestSubmission", { data: { id: "66bb4f8b683bb83a83c26110" } }),
            "400": errorResponse("The access-request payload is invalid.", "VALIDATION_FAILED"),
            "409": errorResponse("A pending request or account already exists for this email.", "CONFLICT"),
            "500": errorResponse("The access request could not be submitted.", "INTERNAL_ERROR", true),
          },
        },
      },
      "/api/admin/access-requests": {
        get: {
          tags: ["Access Requests"], operationId: "listAccessRequests", summary: "List access requests",
          description: "Returns seller and reviewer proposals. Requires an active administrator session.", parameters: [correlationParameter], security: [{ authSessionCookie: [] }],
          responses: { "200": successResponse("Access requests.", "AccessRequestList"), "401": errorResponse("Authentication is required.", "AUTHENTICATION_REQUIRED"), "403": errorResponse("Administrator access is required.", "AUTHORIZATION_DENIED") },
        },
      },
      "/api/admin/access-requests/{id}/approve": {
        post: {
          tags: ["Access Requests"], operationId: "approveAccessRequest", summary: "Approve a pending access request",
          description: "Requires an active administrator and same-origin request. Creates an active reviewer, or an active seller plus seller operator, in one transaction. A decision note is optional; send an empty JSON object when no note is needed.",
          parameters: [correlationParameter, { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } }, { name: "Origin", in: "header", required: true, schema: { type: "string", format: "uri" } }], security: [{ authSessionCookie: [] }],
          requestBody: { required: true, content: jsonContent("AccessRequestDecision", { reason: "Business and identity checks completed." }) },
          responses: { "204": { description: "Request approved and account activation committed.", headers: { "X-Correlation-ID": correlationHeader } }, "401": errorResponse("Authentication is required.", "AUTHENTICATION_REQUIRED"), "403": errorResponse("Administrator access or same-origin request is required.", "AUTHORIZATION_DENIED"), "409": errorResponse("The request is no longer pending.", "CONFLICT") },
        },
      },
      "/api/admin/access-requests/{id}/revoke": {
        post: {
          tags: ["Access Requests"], operationId: "revokeAccessRequest", summary: "Revoke a pending access request",
          description: "Requires an active administrator and same-origin request. Revocation is auditable and does not create an account. A decision note is optional; send an empty JSON object when no note is needed.",
          parameters: [correlationParameter, { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } }, { name: "Origin", in: "header", required: true, schema: { type: "string", format: "uri" } }], security: [{ authSessionCookie: [] }],
          requestBody: { required: true, content: jsonContent("AccessRequestDecision", { reason: "The proposal does not meet onboarding requirements." }) },
          responses: { "204": { description: "Request revoked.", headers: { "X-Correlation-ID": correlationHeader } }, "401": errorResponse("Authentication is required.", "AUTHENTICATION_REQUIRED"), "403": errorResponse("Administrator access or same-origin request is required.", "AUTHORIZATION_DENIED"), "409": errorResponse("The request is no longer pending.", "CONFLICT") },
        },
      },
      "/api/admin/access-requests/{id}/dismiss": {
        post: {
          tags: ["Access Requests"], operationId: "dismissAccessRequest", summary: "Dismiss a completed access request from the current administrator's view",
          description: "Requires an active administrator and same-origin request. Dismissal is per administrator, preserves the access request and its audit history, and only applies to approved or revoked requests.",
          parameters: [correlationParameter, { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } }, { name: "Origin", in: "header", required: true, schema: { type: "string", format: "uri" } }], security: [{ authSessionCookie: [] }],
          requestBody: { required: true, content: jsonContent("AccessRequestDecision", {}) },
          responses: { "204": { description: "Request dismissed from the current administrator's view.", headers: { "X-Correlation-ID": correlationHeader } }, "401": errorResponse("Authentication is required.", "AUTHENTICATION_REQUIRED"), "403": errorResponse("Administrator access or same-origin request is required.", "AUTHORIZATION_DENIED"), "409": errorResponse("Only completed access requests can be dismissed.", "CONFLICT") },
        },
      },
      "/api/internal/bootstrap/admin": {
        post: {
          tags: ["Bootstrap"], operationId: "provisionAdministrator", summary: "Create an administrator",
          description: "Enabled only when `BOOTSTRAP_ADMIN_SECRET` is configured. This protected server-to-server endpoint can provision multiple administrators. Do not expose the bootstrap secret in browsers, logs, or Swagger's authorization storage.",
          parameters: [correlationParameter, { name: "X-CatalogGuard-Bootstrap-Secret", in: "header", required: true, schema: { type: "string", format: "password" } }],
          requestBody: { required: true, content: jsonContent("BootstrapAdmin", { fullName: "Platform Administrator", email: "admin@example.test", password: "Example-strong-password!1" }) },
          responses: { "201": successResponse("Administrator created.", "AccountResponse"), "400": errorResponse("The bootstrap payload is invalid.", "VALIDATION_FAILED"), "403": errorResponse("Bootstrap authorization failed.", "AUTHORIZATION_DENIED"), "409": errorResponse("An account already exists for this email.", "CONFLICT") },
        },
      },
      "/api/internal/validation-results": {
        post: {
          tags: ["Internal integrations"],
          operationId: "acceptOrchestrationValidationResultContract",
          summary: "Verify a signed Orchestration v1 callback and update feed progress",
          description:
            "Verifies the exact HMAC-bound request bytes, callback actor, clock window, persisted feed-job identity, and durable nonce. It updates only feed-level status/counters and appends an audit event; canonical product, issue, and AI effects remain Phase 3 work.",
          parameters: [
            correlationParameter,
            { name: "X-CatalogGuard-Key-Version", in: "header", required: true, schema: { type: "string" } },
            { name: "X-CatalogGuard-Service", in: "header", required: true, schema: { type: "string" } },
            { name: "X-CatalogGuard-Timestamp", in: "header", required: true, schema: { type: "integer", format: "int64" } },
            { name: "X-CatalogGuard-Nonce", in: "header", required: true, schema: { type: "string", format: "uuid" } },
            { name: "X-CatalogGuard-Signature", in: "header", required: true, schema: { type: "string", format: "password" } },
          ],
          requestBody: { required: true, content: jsonContent("ValidationJobResultV1") },
          responses: {
            "204": { description: "Signed v1 callback accepted; feed progress is updated without canonical catalog mutation.", headers: { "X-Correlation-ID": correlationHeader } },
            "401": errorResponse("Service authentication failed or the message is stale.", "SERVICE_AUTHENTICATION_FAILED"),
            "403": errorResponse("The authenticated service does not match the callback actor.", "ACTOR_IDENTITY_MISMATCH"),
            "409": errorResponse("The callback correlation ID mismatches or nonce was already processed.", "SERVICE_MESSAGE_REPLAYED"),
            "415": errorResponse("The callback content type is unsupported.", "JOB_CONTRACT_INVALID"),
            "400": errorResponse("The callback does not match the strict v1 contract.", "JOB_CONTRACT_INVALID"),
          },
        },
      },
      "/api/feeds": {
        get: { tags: ["Feeds"], operationId: "listSellerFeeds", summary: "List the active seller's feeds", description: "Returns a bounded, seller-scoped feed history projection. Storage object keys, credentials, and raw source content are never returned.", parameters: [correlationParameter, { name: "cursor", in: "query", required: false, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } }], security: [{ authSessionCookie: [] }], responses: { "200": successResponse("Seller feed history.", "FeedListResponse"), "401": errorResponse("Authentication is required.", "AUTHENTICATION_REQUIRED"), "403": errorResponse("Seller access is required.", "AUTHORIZATION_DENIED") } },
        post: { tags: ["Feeds"], operationId: "createSellerFeed", summary: "Store a private CSV and dispatch validation", description: "Requires an active seller session and same-origin multipart request. Validates CSV filename/type/basic structure, calculates checksum, stores one immutable private R2 object, persists the feed and audit event, then sends its signed idempotent job to Orchestration. Browser callers never receive storage identifiers.", parameters: [correlationParameter, { name: "Origin", in: "header", required: true, schema: { type: "string", format: "uri" } }], security: [{ authSessionCookie: [] }], requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: "CSV product listing, at most the configured private-upload limit." } }, additionalProperties: false } } } }, responses: { "201": successResponse("Private feed stored and signed validation job accepted.", "CreateFeedResponse"), "400": errorResponse("The CSV is missing or malformed.", "FILE_REJECTED"), "409": errorResponse("The same checksum already exists for this seller.", "DUPLICATE_UPLOAD"), "413": errorResponse("The CSV exceeds the configured upload size.", "FILE_REJECTED"), "503": errorResponse("Storage or Orchestration dispatch is unavailable; no catalog data was created.", "FEED_DISPATCH_FAILED", true) } },
      },
      "/api/feeds/{id}": { get: { tags: ["Feeds"], operationId: "getSellerFeed", summary: "Read one seller-scoped feed", description: "Returns the persisted processing timeline, source-integrity projection, status counters, and permitted action for a feed in the active seller scope.", parameters: [correlationParameter, { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } }], security: [{ authSessionCookie: [] }], responses: { "200": successResponse("Seller feed detail.", "FeedDetailResponse"), "401": errorResponse("Authentication is required.", "AUTHENTICATION_REQUIRED"), "403": errorResponse("Seller access is required.", "AUTHORIZATION_DENIED"), "404": errorResponse("The feed is not in the active seller scope.", "FEED_NOT_FOUND") } } },
      "/api/feeds/{id}/download": { post: { tags: ["Feeds"], operationId: "createSellerFeedDownload", summary: "Create a short-lived private CSV download", description: "Requires an active seller session and same-origin request. Authorizes the feed in the trusted seller scope before returning a short-lived R2 URL; the storage key is never exposed.", parameters: [correlationParameter, { name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } }, { name: "Origin", in: "header", required: true, schema: { type: "string", format: "uri" } }], security: [{ authSessionCookie: [] }], responses: { "200": successResponse("Short-lived download URL.", "FeedDownloadResponse"), "401": errorResponse("Authentication is required.", "AUTHENTICATION_REQUIRED"), "403": errorResponse("Seller access or request origin is not allowed.", "AUTHORIZATION_DENIED"), "404": errorResponse("The feed is not in the active seller scope.", "FEED_NOT_FOUND"), "503": errorResponse("Private storage is unavailable.", "DEPENDENCY_UNAVAILABLE", true) } } },
      "/api/openapi.json": {
        get: {
          tags: ["Operations"],
          operationId: "getWebOpenApiDocument",
          summary: "Download the Web OpenAPI document",
          description: "Returns this OpenAPI 3.1 document when API documentation is enabled.",
          responses: {
            "200": {
              description: "OpenAPI 3.1 document.",
              content: { "application/json": { schema: { type: "object" } } },
            },
            "404": { description: "API documentation is disabled." },
          },
        },
      },
      "/api/docs": {
        get: {
          tags: ["Operations"],
          operationId: "getWebSwaggerUi",
          summary: "Open Web Swagger UI",
          description: "Interactive Swagger UI backed by `/api/openapi.json`.",
          responses: {
            "200": { description: "Swagger UI HTML.", content: { "text/html": {} } },
            "404": { description: "API documentation is disabled." },
          },
        },
      },
    },
    components: {
      schemas: {
        HealthResponse: componentSchema(healthResponseSchema),
        ReadinessResponse: componentSchema(readinessResponseSchema),
        ErrorEnvelope: componentSchema(errorEnvelopeSchema),
        AccountResponse: componentSchema(accountResponseSchema),
        CreateAccessRequest: componentSchema(createAccessRequestSchema, "input"),
        AccessRequestSubmission: componentSchema(accessRequestSubmissionSchema),
        AccessRequestList: componentSchema(accessRequestListSchema),
        AccessRequestDecision: componentSchema(decideAccessRequestSchema, "input"),
        BootstrapAdmin: componentSchema(bootstrapAdminSchema, "input"),
        PasswordChangeRequest: componentSchema(passwordChangeSchema, "input"),
        LoginCredentials: componentSchema(loginCredentialsSchema, "input"),
        CredentialsCallbackRequest: componentSchema(credentialsCallbackSchema, "input"),
        SignOutRequest: componentSchema(signOutRequestSchema, "input"),
        AuthSessionResponse: componentSchema(authSessionResponseSchema),
        AuthProvidersResponse: componentSchema(authProvidersResponseSchema),
        CsrfTokenResponse: componentSchema(csrfTokenResponseSchema),
        ValidationJobResultV1: componentSchema(validationJobResultSchema, "input"),
        CreateFeedResponse: componentSchema(createFeedResponseSchema),
        FeedListResponse: componentSchema(feedListResponseSchema),
        FeedDetailResponse: componentSchema(feedDetailResponseSchema),
        FeedDownloadResponse: componentSchema(feedDownloadResponseSchema),
      },
      parameters: {
        CorrelationId: {
          name: "X-Correlation-ID",
          in: "header",
          required: false,
          description: "Optional UUID trace identifier. Invalid or missing values are replaced safely.",
          schema: { type: "string", format: "uuid" },
        },
      },
      headers: {
        CorrelationId: {
          description: "UUID used to correlate requests, errors, logs, jobs, and callbacks.",
          schema: { type: "string", format: "uuid" },
        },
      },
      securitySchemes: {
        authSessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "authjs.session-token",
          description:
            "HttpOnly Auth.js session cookie. Secure deployments may use the `__Secure-` cookie prefix; Swagger never stores a real cookie value.",
        },
      },
    },
  };
}
