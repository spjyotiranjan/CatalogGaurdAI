import { registerOTel } from "@vercel/otel";

import { getEnvironment, validateEnvironment } from "@/server/config/env";

export function register() {
  validateEnvironment();
  const environment = getEnvironment();
  registerOTel({
    serviceName: environment.CATALOGGUARD_SERVICE_NAME,
  });

  if (environment.API_DOCS_ENABLED) {
    const applicationUrl = new URL(environment.AUTH_URL);
    console.info(
      [
        "",
        "CatalogGuard Web is ready",
        `  API:      ${new URL("/api", applicationUrl)}`,
        `  OpenAPI:  ${new URL("/api/openapi.json", applicationUrl)}`,
        `  Swagger:  ${new URL("/api/docs", applicationUrl)}`,
      ].join("\n"),
    );
  }
}
