import { describe, expect, it } from "vitest";

import {
  createAccessRequestSchema,
  decideAccessRequestSchema,
} from "@/lib/contracts/access-requests";
import { toAccessRequestPersistenceInput } from "@/server/services/access-requests";

describe("access request validation", () => {
  it("returns field-specific guidance for an undersized seller proposal", () => {
    const parsed = createAccessRequestSchema.safeParse({
      role: "SELLER_OPERATOR",
      fullName: "Alfred Seller",
      email: "alfred@example.com",
      password: "StrongPassword!123",
      businessName: "Alfred",
      contactPhone: "7008347705",
      proposal: "I am a seller",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.proposal).toEqual([
        "Tell us more in at least 20 characters.",
      ]);
    }
  });

  it("never passes a plaintext password to persistence", () => {
    const input = {
      role: "SELLER_OPERATOR" as const,
      fullName: "Alfred Seller",
      email: "alfred@example.com",
      password: "StrongPassword!123",
      proposal: "I sell a curated catalog of products.",
      businessName: "Alfred",
      contactPhone: "7008347705",
    };

    expect(toAccessRequestPersistenceInput(input)).toEqual({
      role: input.role,
      fullName: input.fullName,
      email: input.email,
      proposal: input.proposal,
      businessName: input.businessName,
      contactPhone: input.contactPhone,
    });
  });

  it("accepts an omitted or unrestricted optional decision note", () => {
    expect(decideAccessRequestSchema.safeParse({}).success).toBe(true);
    expect(
      decideAccessRequestSchema.safeParse({ reason: "A".repeat(10_000) }).success,
    ).toBe(true);
  });
});
