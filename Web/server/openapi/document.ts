import "server-only";

import { z } from "zod";

import { accountResponseSchema } from "@/lib/contracts/account";
import {
  loginCredentialsSchema,
  passwordChangeSchema,
} from "@/lib/contracts/auth";
import { errorEnvelopeSchema } from "@/lib/contracts/errors";
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
  return jsonSchema;
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
              "A required dependency is unavailable.",
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
        PasswordChangeRequest: componentSchema(passwordChangeSchema, "input"),
        LoginCredentials: componentSchema(loginCredentialsSchema, "input"),
        CredentialsCallbackRequest: componentSchema(credentialsCallbackSchema, "input"),
        SignOutRequest: componentSchema(signOutRequestSchema, "input"),
        AuthSessionResponse: componentSchema(authSessionResponseSchema),
        AuthProvidersResponse: componentSchema(authProvidersResponseSchema),
        CsrfTokenResponse: componentSchema(csrfTokenResponseSchema),
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
