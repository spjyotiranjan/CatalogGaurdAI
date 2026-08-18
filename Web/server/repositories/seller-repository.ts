import "server-only";

import { Types, type ClientSession } from "mongoose";

import { connectToDatabase } from "@/server/db/mongoose";
import { SellerModel } from "@/server/models/seller";

export type SellerSummary = {
  id: string;
  sellerCode: string;
  businessName: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

export class SellerRepository {
  async create(input: { sellerCode: string; businessName: string; contactEmail: string; contactPhone?: string; status: "ACTIVE" | "INACTIVE" | "SUSPENDED" }, session: ClientSession): Promise<SellerSummary> {
    await connectToDatabase();
    const [seller] = await SellerModel.create([{ ...input }], { session });
    return { id: seller._id.toString(), sellerCode: seller.sellerCode, businessName: seller.businessName, status: seller.status };
  }
  async findInTrustedScope(
    trustedSellerId: string,
    requestedSellerId: string,
  ): Promise<SellerSummary | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(trustedSellerId) || !Types.ObjectId.isValid(requestedSellerId)) {
      return null;
    }

    const seller = await SellerModel.findOne({
      _id: new Types.ObjectId(requestedSellerId),
      $expr: { $eq: ["$_id", new Types.ObjectId(trustedSellerId)] },
    })
      .select("sellerCode businessName status")
      .lean()
      .exec();

    return seller
      ? {
          id: seller._id.toString(),
          sellerCode: seller.sellerCode,
          businessName: seller.businessName,
          status: seller.status,
        }
      : null;
  }
}

export const sellerRepository = new SellerRepository();
