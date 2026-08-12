import { describe, expect, it } from "vitest";

import {
  CORRELATION_ID_HEADER,
  isValidCorrelationId,
  resolveCorrelationId,
} from "@/lib/request/correlation-id";

describe("correlation IDs", () => {
  it("preserves a valid incoming ID", () => {
    const id = "4f864f99-aa42-49f5-93cd-77369c20f213";
    expect(resolveCorrelationId(new Headers({ [CORRELATION_ID_HEADER]: id }))).toBe(id);
  });

  it("replaces an invalid incoming ID", () => {
    const resolved = resolveCorrelationId(
      new Headers({ [CORRELATION_ID_HEADER]: "untrusted-value" }),
    );
    expect(resolved).not.toBe("untrusted-value");
    expect(isValidCorrelationId(resolved)).toBe(true);
  });
});
