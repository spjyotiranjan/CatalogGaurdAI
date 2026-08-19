import { describe, expect, it, vi } from "vitest";

import { AuthenticationService } from "@/server/auth/authentication-service";
import { hashPassword } from "@/server/auth/passwords";
import type { AuthenticationUser } from "@/server/repositories/user-repository";
import { parseAuthJsCredentials } from "@/lib/contracts/auth";

const activeUser: AuthenticationUser = {
  id: "66bb4f8b683bb83a83c26111",
  sellerId: null,
  fullName: "Administrator",
  email: "admin@example.com",
  passwordHash: "",
  role: "ADMIN",
  status: "ACTIVE",
};

function serviceFor(user: AuthenticationUser | null, allowed = true) {
  return new AuthenticationService(
    {
      findForAuthenticationByEmail: vi.fn().mockResolvedValue(user),
      recordSuccessfulLogin: vi.fn(),
    },
    {
      consume: vi.fn().mockReturnValue({ allowed, retryAfterSeconds: allowed ? 0 : 60 }),
    },
  );
}

describe("AuthenticationService", () => {
  it("extracts credentials from an Auth.js callback body containing framework fields", () => {
    const parsed = parseAuthJsCredentials({
      email: " Admin@Example.com ",
      password: "CorrectPassword!1",
      csrfToken: "framework-managed-token",
      callbackUrl: "http://localhost:3000/login",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        email: "Admin@Example.com",
        password: "CorrectPassword!1",
      });
    }
  });

  it("uses the same safe failure for an unknown email and a wrong password", async () => {
    const unknown = await serviceFor(null).authenticate(
      { email: "unknown@example.com", password: "WrongPassword!1" },
      "unknown-key",
      "4f864f99-aa42-49f5-93cd-77369c20f213",
    );
    const existing = await serviceFor({
      ...activeUser,
      passwordHash: await hashPassword("CorrectPassword!1"),
    }).authenticate(
      { email: activeUser.email, password: "WrongPassword!1" },
      "existing-key",
      "4f864f99-aa42-49f5-93cd-77369c20f213",
    );

    expect(unknown).toEqual({ user: null, failureReason: "INVALID_CREDENTIALS" });
    expect(existing).toEqual({ user: null, failureReason: "INVALID_CREDENTIALS" });
  });

  it("rejects an inactive user even with a valid password", async () => {
    const result = await serviceFor({
      ...activeUser,
      status: "DISABLED",
      passwordHash: await hashPassword("CorrectPassword!1"),
    }).authenticate(
      { email: activeUser.email, password: "CorrectPassword!1" },
      "disabled-key",
      "4f864f99-aa42-49f5-93cd-77369c20f213",
    );
    expect(result).toEqual({ user: null, failureReason: "INACTIVE_USER" });
  });

  it("applies the login rate limit before credential lookup", async () => {
    const service = serviceFor(activeUser, false);
    await expect(
      service.authenticate(
        { email: activeUser.email, password: "Password!123" },
        "limited-key",
        "4f864f99-aa42-49f5-93cd-77369c20f213",
      ),
    ).resolves.toEqual({ user: null, failureReason: "RATE_LIMITED" });
  });
});
