import { z } from "zod";

import { userRoleSchema, userStatusSchema } from "@/lib/contracts/auth";

export const healthResponseSchema = z
  .object({
    status: z.literal("ok"),
    service: z.string().min(1),
    version: z.string().min(1),
  })
  .strict();

export const readinessResponseSchema = z
  .object({
    status: z.literal("ready"),
    service: z.string().min(1),
    version: z.string().min(1),
    dependencies: z.object({ mongodb: z.literal("ready") }).strict(),
  })
  .strict();

export const authSessionResponseSchema = z.union([
  z
    .object({
      user: z
        .object({
          id: z.string().regex(/^[a-f\d]{24}$/i),
          sellerId: z.string().regex(/^[a-f\d]{24}$/i).nullable(),
          name: z.string().nullable().optional(),
          email: z.email().nullable().optional(),
          image: z.url().nullable().optional(),
          role: userRoleSchema,
          status: userStatusSchema,
        })
        .strict(),
      expires: z.iso.datetime(),
    })
    .strict(),
  z.null(),
]);

export const csrfTokenResponseSchema = z
  .object({ csrfToken: z.string().min(1) })
  .strict();

export const authProvidersResponseSchema = z.record(
  z.string(),
  z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      type: z.string().min(1),
      signinUrl: z.url(),
      callbackUrl: z.url(),
    })
    .strict(),
);
