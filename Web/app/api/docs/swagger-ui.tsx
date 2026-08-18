"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export function WebSwaggerUi() {
  return (
    <SwaggerUI
      url="/api/openapi.json"
      deepLinking
      displayOperationId
      displayRequestDuration
      docExpansion="list"
      defaultModelsExpandDepth={2}
      persistAuthorization={false}
      requestSnippetsEnabled
      tryItOutEnabled
      withCredentials
    />
  );
}
