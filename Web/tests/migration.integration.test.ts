import type { Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthenticationService } from "@/server/auth/authentication-service";
import { hashPassword } from "@/server/auth/passwords";
import { resetEnvironmentForTests } from "@/server/config/env";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "@/server/db/mongoose";
import { phaseOneFoundationMigration } from "@/server/migrations/001-phase-one-foundation";
import { runDatabaseMigrations } from "@/server/migrations/runner";
import { AuditLogModel } from "@/server/models/audit-log";
import { UserModel } from "@/server/models/user";
import { userRepository } from "@/server/repositories/user-repository";

describe("Phase 1 database migration", () => {
  let server: MongoMemoryReplSet | undefined;
  let database: Db;

  beforeAll(async () => {
    server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = server.getUri();
    process.env.MONGODB_DB_NAME = "catalogguard_phase_one_test";
    resetEnvironmentForTests();
    const connection = await connectToDatabase();
    if (!connection.connection.db) {
      throw new Error("Test MongoDB did not expose a database");
    }
    database = connection.connection.db;
    await phaseOneFoundationMigration.up(database);
    await phaseOneFoundationMigration.up(database);
  }, 180_000);

  afterAll(async () => {
    await disconnectFromDatabase();
    await server?.stop();
  });

  it("is repeatable and creates validated collections with required indexes", async () => {
    const collections = await database
      .listCollections({}, { nameOnly: true })
      .toArray();
    expect(collections.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["sellers", "users", "categories", "audit_logs"]),
    );

    const userIndexes = await database.collection("users").indexes();
    expect(userIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "user_email_unique", unique: true }),
      ]),
    );

    await expect(
      database.collection("users").insertOne({
        sellerId: null,
        fullName: "Invalid Seller Operator",
        email: "operator@example.com",
        passwordHash: "hashed-password-value",
        role: "SELLER_OPERATOR",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 121 });
  });

  it("atomically records a successful login and its audit event", async () => {
    const password = "CorrectHorse!Battery9";
    const created = await userRepository.create({
      sellerId: null,
      fullName: "Phase One Admin",
      email: "phase-one-admin@example.com",
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      status: "ACTIVE",
    });
    const service = new AuthenticationService(userRepository, {
      consume: () => ({ allowed: true, remaining: 9, retryAfterSeconds: 0 }),
    });

    const result = await service.authenticate(
      { email: created.email, password },
      "integration-login",
      "4f864f99-aa42-49f5-93cd-77369c20f213",
    );
    expect(result.user?.id).toBe(created.id);

    const [persistedUser, auditEvent] = await Promise.all([
      UserModel.findById(created.id).select("lastLoginAt").lean().exec(),
      AuditLogModel.findOne({
        entityType: "AUTH",
        entityId: created.id,
        action: "LOGIN_SUCCEEDED",
      })
        .lean()
        .exec(),
    ]);
    expect(persistedUser?.lastLoginAt).toBeInstanceOf(Date);
    expect(auditEvent?.correlationId).toBe(
      "4f864f99-aa42-49f5-93cd-77369c20f213",
    );
  });

  it("runs the controlled migration command idempotently", async () => {
    await runDatabaseMigrations(database);
    await runDatabaseMigrations(database);

    const history = await database
      .collection("_schema_migrations")
      .find({ id: "004-orchestration-phase-one-bridge" })
      .toArray();
    expect(history).toHaveLength(1);

    const accessRequestIndexes = await database.collection("access_requests").indexes();
    expect(accessRequestIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "access_request_dismissed_status" }),
      ]),
    );

    const nonceIndexes = await database.collection("service_message_nonces").indexes();
    expect(nonceIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "service_message_nonce_unique", unique: true }),
        expect.objectContaining({ name: "service_message_nonce_expiry", expireAfterSeconds: 0 }),
      ]),
    );
  });
});
