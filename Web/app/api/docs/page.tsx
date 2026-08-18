import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WebSwaggerUi } from "@/app/api/docs/swagger-ui";
import { getEnvironment } from "@/server/config/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Web API Documentation | CatalogGuard AI",
  description: "Interactive OpenAPI documentation for the CatalogGuard Web backend.",
};

export default function WebApiDocumentationPage() {
  if (!getEnvironment().API_DOCS_ENABLED) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <WebSwaggerUi />
    </main>
  );
}
