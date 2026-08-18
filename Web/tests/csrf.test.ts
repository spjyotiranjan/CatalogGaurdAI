import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/contracts/errors";
import { assertSameOrigin } from "@/server/auth/csrf";

describe("same-origin mutation guard", () => {
  it("accepts a same-origin request", () => {
    const request = new Request("http://localhost:3000/api/account/password", {
      method: "PATCH",
      headers: { origin: "http://localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects a cross-origin request", () => {
    const request = new Request("http://localhost:3000/api/account/password", {
      method: "PATCH",
      headers: { origin: "https://attacker.example" },
    });
    expect(() => assertSameOrigin(request)).toThrowError(AppError);
  });
});
