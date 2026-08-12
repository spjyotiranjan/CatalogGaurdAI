import { z } from "zod";

export const userRoleSchema = z.enum([
  "ADMIN",
  "CATALOG_REVIEWER",
  "SELLER_OPERATOR",
]);

export const userStatusSchema = z.enum(["ACTIVE", "INVITED", "DISABLED"]);

export const loginCredentialsSchema = z
  .object({
    email: z.email().trim().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z
      .string()
      .min(12)
      .max(128)
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a symbol"),
  })
  .strict();

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

