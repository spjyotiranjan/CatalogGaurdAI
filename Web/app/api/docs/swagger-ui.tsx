"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

// Swagger UI supports this runtime option, but its published React prop type
// does not include it. Disable the remote validator to keep local docs from
// hanging when validator.swagger.io is unavailable.
const localDocumentationOptions = { validatorUrl: null };

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
      {...localDocumentationOptions}
    />
  );
}
