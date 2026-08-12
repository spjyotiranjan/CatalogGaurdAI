import { z } from "zod";

import { userRoleSchema, userStatusSchema } from "@/lib/contracts/auth";

export const accountResponseSchema = z
  .object({
    data: z
      .object({
        id: z.string().regex(/^[a-f\d]{24}$/i),
        sellerId: z.string().regex(/^[a-f\d]{24}$/i).nullable(),
        fullName: z.string().min(1),
        email: z.email(),
        role: userRoleSchema,
        status: userStatusSchema,
      })
      .strict(),
  })
  .strict();

export type AccountResponse = z.infer<typeof accountResponseSchema>;
