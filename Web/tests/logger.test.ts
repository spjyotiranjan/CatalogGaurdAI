import { describe, expect, it, vi } from "vitest";

import { logger } from "@/server/observability/logger";

describe("structured logger", () => {
  it("redacts sensitive context fields", () => {
    process.env.LOG_LEVEL = "info";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logger.info("Safe event", {
      correlationId: "4f864f99-aa42-49f5-93cd-77369c20f213",
      operation: "test.log",
      password: "do-not-log",
      storageLocation: "private://do-not-log",
    });

    const serialized = String(info.mock.calls[0]?.[0]);
    expect(serialized).toContain("test.log");
    expect(serialized).not.toContain("do-not-log");
    expect(serialized).not.toContain("storageLocation");
    info.mockRestore();
  });
});
