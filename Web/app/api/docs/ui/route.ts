import { getEnvironment } from "@/server/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const swaggerUiDocument = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CatalogGuard Web API documentation</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayOperationId: true,
        displayRequestDuration: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 2,
        persistAuthorization: false,
        requestSnippetsEnabled: true,
        tryItOutEnabled: true,
        withCredentials: true,
        validatorUrl: null
      });
    </script>
  </body>
</html>`;

export function GET() {
  if (!getEnvironment().API_DOCS_ENABLED) {
    return new Response(null, { status: 404 });
  }

  return new Response(swaggerUiDocument, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
