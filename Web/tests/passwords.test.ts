import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/passwords";

describe("password hashing", () => {
  it("stores a salted one-way hash and verifies it", async () => {
    const password = "CorrectHorse!Battery9";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(password);
    expect(second).not.toBe(first);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(verifyPassword("incorrect", first)).resolves.toBe(false);
  });
});
