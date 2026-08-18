import { z } from "zod";

import { passwordChangeSchema } from "@/lib/contracts/auth";

export const accessRequestRoleSchema = z.enum(["SELLER_OPERATOR", "CATALOG_REVIEWER"]);
export const accessRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REVOKED"]);

export const createAccessRequestSchema = z.object({
  role: accessRequestRoleSchema,
  fullName: z.string().trim().min(2, "Enter your full name.").max(120, "Full name must be 120 characters or fewer."),
  email: z.string().trim().email("Enter a valid work email address.").max(254, "Email address must be 254 characters or fewer."),
  password: passwordChangeSchema.shape.newPassword,
  proposal: z.string().trim().min(20, "Tell us more in at least 20 characters.").max(2_000, "Proposal must be 2,000 characters or fewer."),
  businessName: z.string().trim().min(2, "Enter your business name.").max(160, "Business name must be 160 characters or fewer.").optional(),
  contactPhone: z.string().trim().min(6, "Enter a valid contact phone number.").max(32, "Contact phone must be 32 characters or fewer.").optional(),
}).strict().superRefine((value, context) => {
  if (value.role === "SELLER_OPERATOR" && !value.businessName) {
    context.addIssue({ code: "custom", path: ["businessName"], message: "Enter your business name." });
  }
});

export const accessRequestSummarySchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
  role: accessRequestRoleSchema,
  fullName: z.string(),
  email: z.email(),
  proposal: z.string(),
  businessName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  status: accessRequestStatusSchema,
  submittedAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  decisionReason: z.string().nullable(),
}).strict();

export const accessRequestListSchema = z.object({ data: z.array(accessRequestSummarySchema) }).strict();
export const accessRequestSubmissionSchema = z.object({ data: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict() }).strict();
export const decideAccessRequestSchema = z.object({ reason: z.string().trim().optional() }).strict();
export const bootstrapAdminSchema = z.object({ fullName: z.string().trim().min(2).max(120), email: z.email().trim().max(254), password: passwordChangeSchema.shape.newPassword }).strict();

export type AccessRequestSummary = z.infer<typeof accessRequestSummarySchema>;
