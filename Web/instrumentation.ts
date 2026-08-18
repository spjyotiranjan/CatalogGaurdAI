import { registerOTel } from "@vercel/otel";

import { getEnvironment, validateEnvironment } from "@/server/config/env";

export function register() {
  validateEnvironment();
  const environment = getEnvironment();
  registerOTel({
    serviceName: environment.CATALOGGUARD_SERVICE_NAME,
  });
}
