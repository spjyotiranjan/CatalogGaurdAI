import "server-only";

import type { ClientSession } from "mongoose";

import { connectToDatabase } from "@/server/db/mongoose";
import { ServiceMessageNonceModel } from "@/server/models/service-message-nonce";

export class ServiceMessageNonceRepository {
  async claim(input: {
    serviceId: string;
    keyVersion: string;
    nonce: string;
    retentionSeconds: number;
    session: ClientSession;
  }): Promise<boolean> {
    await connectToDatabase();
    try {
      await ServiceMessageNonceModel.create(
        [{
          serviceId: input.serviceId,
          keyVersion: input.keyVersion,
          nonce: input.nonce,
          expiresAt: new Date(Date.now() + input.retentionSeconds * 1_000),
        }],
        { session: input.session },
      );
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000) return false;
      throw error;
    }
  }
}

export const serviceMessageNonceRepository = new ServiceMessageNonceRepository();
