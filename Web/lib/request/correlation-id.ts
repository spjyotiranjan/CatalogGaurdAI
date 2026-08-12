import { randomUUID } from "node:crypto";

export const CORRELATION_ID_HEADER = "x-correlation-id";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidCorrelationId(value: string | null | undefined): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function resolveCorrelationId(headers: Headers): string {
  const supplied = headers.get(CORRELATION_ID_HEADER);
  return isValidCorrelationId(supplied) ? supplied.toLowerCase() : randomUUID();
}

