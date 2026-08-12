import "server-only";

import { AppError } from "@/lib/contracts/errors";
import { getEnvironment } from "@/server/config/env";

export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new AppError({
      code: "AUTHORIZATION_DENIED",
      message: "Cross-site requests are not allowed.",
      status: 403,
    });
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    throw new AppError({
      code: "AUTHORIZATION_DENIED",
      message: "A same-origin request is required.",
      status: 403,
    });
  }

  let suppliedOrigin: string;
  try {
    suppliedOrigin = new URL(origin).origin;
  } catch {
    throw new AppError({
      code: "AUTHORIZATION_DENIED",
      message: "A same-origin request is required.",
      status: 403,
    });
  }

  const expectedOrigin = new URL(getEnvironment().AUTH_URL).origin;
  if (suppliedOrigin.toLowerCase() !== expectedOrigin.toLowerCase()) {
    throw new AppError({
      code: "AUTHORIZATION_DENIED",
      message: "Cross-origin requests are not allowed.",
      status: 403,
    });
  }
}
