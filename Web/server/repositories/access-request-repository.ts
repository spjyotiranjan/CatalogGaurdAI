import "server-only";

import { Types, type ClientSession } from "mongoose";

import type { AccessRequestSummary } from "@/lib/contracts/access-requests";
import { normalizeEmail } from "@/lib/contracts/auth";
import { connectToDatabase } from "@/server/db/mongoose";
import { AccessRequestModel } from "@/server/models/access-request";

type StoredAccessRequest = {
  _id: Types.ObjectId; role: AccessRequestSummary["role"]; fullName: string; email: string; proposal: string;
  businessName: string | null; contactPhone: string | null; status: AccessRequestSummary["status"];
  createdAt: Date; decidedAt: Date | null; decisionReason: string | null; passwordHash?: string;
};

function summary(request: StoredAccessRequest): AccessRequestSummary {
  return { id: request._id.toString(), role: request.role, fullName: request.fullName, email: request.email,
    proposal: request.proposal, businessName: request.businessName, contactPhone: request.contactPhone,
    status: request.status, submittedAt: request.createdAt.toISOString(), decidedAt: request.decidedAt?.toISOString() ?? null,
    decisionReason: request.decisionReason };
}

export class AccessRequestRepository {
  async create(input: { role: AccessRequestSummary["role"]; fullName: string; email: string; passwordHash: string; proposal: string; businessName?: string; contactPhone?: string }): Promise<string> {
    await connectToDatabase();
    const created = await AccessRequestModel.create({ ...input, email: normalizeEmail(input.email), status: "PENDING" });
    return created._id.toString();
  }

  async hasPendingForEmail(email: string): Promise<boolean> {
    await connectToDatabase();
    return Boolean(await AccessRequestModel.exists({ email: normalizeEmail(email), status: "PENDING" }));
  }

  async list(dismissedByUserId: string): Promise<AccessRequestSummary[]> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(dismissedByUserId)) return [];
    const requests = await AccessRequestModel.find({ dismissedByUserIds: { $ne: new Types.ObjectId(dismissedByUserId) } }).select("role fullName email proposal businessName contactPhone status createdAt decidedAt decisionReason").sort({ status: 1, createdAt: -1 }).lean().exec();
    return requests.map((request) => summary(request as StoredAccessRequest));
  }

  async decidePending(id: string, input: { status: "APPROVED" | "REVOKED"; adminUserId: string; reason: string | null }, session: ClientSession): Promise<StoredAccessRequest | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const request = await AccessRequestModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), status: "PENDING" },
      { $set: { status: input.status, decidedByUserId: new Types.ObjectId(input.adminUserId), decidedAt: new Date(), decisionReason: input.reason } },
      { new: true, session },
    ).select("+passwordHash role fullName email proposal businessName contactPhone status createdAt decidedAt decisionReason").lean().exec();
    return request as StoredAccessRequest | null;
  }

  async dismissCompleted(id: string, adminUserId: string, session: ClientSession): Promise<boolean> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(adminUserId)) return false;
    const result = await AccessRequestModel.updateOne(
      { _id: new Types.ObjectId(id), status: { $in: ["APPROVED", "REVOKED"] } },
      { $addToSet: { dismissedByUserIds: new Types.ObjectId(adminUserId) } },
      { session },
    ).exec();
    return result.matchedCount === 1;
  }
}
export const accessRequestRepository = new AccessRequestRepository();
