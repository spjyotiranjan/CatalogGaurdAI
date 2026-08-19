import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getEnvironment } from "@/server/config/env";

export const runtime = "nodejs";

const swaggerAssets = {
  "swagger-ui-bundle.js": "application/javascript; charset=utf-8",
  "swagger-ui.css": "text/css; charset=utf-8",
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  if (!getEnvironment().API_DOCS_ENABLED) {
    return new Response(null, { status: 404 });
  }

  const { asset } = await params;
  const contentType = swaggerAssets[asset as keyof typeof swaggerAssets];
  if (!contentType) {
    return new Response(null, { status: 404 });
  }

  const file = await readFile(join(process.cwd(), "node_modules", "swagger-ui-dist", asset));
  return new Response(file, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    },
  });
}
