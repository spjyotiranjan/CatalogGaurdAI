import "server-only";

import type { DatabaseMigration } from "@/server/migrations/types";
import { ServiceMessageNonceModel } from "@/server/models/service-message-nonce";

export const orchestrationPhaseOneBridgeMigration: DatabaseMigration = {
  id: "004-orchestration-phase-one-bridge",
  description: "Create durable replay protection for Orchestration callbacks",
  async up(database) {
    const exists = await database
      .listCollections({ name: "service_message_nonces" }, { nameOnly: true })
      .hasNext();
    const validation = {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["serviceId", "keyVersion", "nonce", "receivedAt", "expiresAt"],
          properties: {
            serviceId: { bsonType: "string", minLength: 3 },
            keyVersion: { bsonType: "string", minLength: 1 },
            nonce: { bsonType: "string", minLength: 1 },
            receivedAt: { bsonType: "date" },
            expiresAt: { bsonType: "date" },
          },
        },
      },
      validationLevel: "strict" as const,
      validationAction: "error" as const,
    };
    if (exists) await database.command({ collMod: "service_message_nonces", ...validation });
    else await database.createCollection("service_message_nonces", validation);
    await ServiceMessageNonceModel.createIndexes();
  },
};
