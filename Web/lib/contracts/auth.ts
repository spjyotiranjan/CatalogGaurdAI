import { z } from "zod";

export const userRoleSchema = z.enum([
  "ADMIN",
  "CATALOG_REVIEWER",
  "SELLER_OPERATOR",
]);

export const userStatusSchema = z.enum(["ACTIVE", "INVITED", "DISABLED"]);

export const loginCredentialsSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

/**
 * Extracts only application-owned fields from Auth.js' callback body.
 * Auth.js also submits framework fields such as csrfToken and callbackUrl.
 */
export function parseAuthJsCredentials(input: Record<string, unknown> | undefined) {
  return loginCredentialsSchema.safeParse({
    email: input?.email,
    password: input?.password,
  });
}

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(128)
      .regex(/[a-z]/, "Include a lowercase letter.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[0-9]/, "Include a number.")
      .regex(/[^A-Za-z0-9]/, "Include a symbol."),
  })
  .strict();

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

