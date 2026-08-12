import { createOpenApiDocument } from "@/server/openapi/document";
import { getEnvironment } from "@/server/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  if (!getEnvironment().API_DOCS_ENABLED) {
    return new Response(null, { status: 404 });
  }

  return Response.json(createOpenApiDocument(), {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
