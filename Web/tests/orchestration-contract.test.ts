import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as acceptValidationResult } from "@/app/api/internal/validation-results/route";
import { validationJobRequestSchema, validationJobResultSchema } from "@/lib/contracts/orchestration";
import { resetEnvironmentForTests } from "@/server/config/env";
import { connectToDatabase, disconnectFromDatabase } from "@/server/db/mongoose";
import { runDatabaseMigrations } from "@/server/migrations/runner";
import { AuditLogModel } from "@/server/models/audit-log";
import { ServiceMessageNonceModel } from "@/server/models/service-message-nonce";
import { FeedUploadModel } from "@/server/models/feed-upload";
import { canonicalOrchestrationMessage, signOrchestrationMessage } from "@/server/integrations/orchestration/signing";

const contractRoot = fileURLToPath(new URL("../../Orchestration/contracts/v1/", import.meta.url));
const fixtureRoot = fileURLToPath(new URL("../../Orchestration/fastapi/tests/fixtures/", import.meta.url));

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(`${contractRoot}${relativePath}`, "utf8"));
}

describe("Phase 1 Orchestration bridge", () => {
  let server: MongoMemoryReplSet | undefined;

  beforeAll(async () => {
    server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = server.getUri();
    process.env.MONGODB_DB_NAME = "catalogguard_orchestration_bridge_test";
    resetEnvironmentForTests();
    const connection = await connectToDatabase();
    if (!connection.connection.db) throw new Error("Test MongoDB did not expose a database");
    await runDatabaseMigrations(connection.connection.db);
  }, 180_000);

  afterAll(async () => {
    await disconnectFromDatabase();
    await server?.stop();
  });

  it("matches Orchestration's language-neutral D-012 signature vector", async () => {
    const vector = await readJson("signature-test-vector.json") as {
      body: string; keyVersion: string; serviceId: string; timestamp: number; nonce: string; method: string; path: string; secret: string; signature: string;
    };
    const body = new TextEncoder().encode(vector.body);
    expect(canonicalOrchestrationMessage({ ...vector, body })).toBeInstanceOf(Buffer);
    expect(signOrchestrationMessage({ ...vector, body })).toBe(vector.signature);
  });

  it("matches the strict Web-to-Orchestration v1 request shape", async () => {
    const publishedSchema = await readJson("validation-job-request.schema.json") as { $id: string; additionalProperties: boolean };
    const request = {
      contractVersion: "v1",
      jobId: "33333333-3333-4333-8333-333333333333",
      idempotencyKey: "feed-validation:fixture-1",
      feed: {
        feedUploadId: "66bb4f8b683bb83a83c26222",
        sellerId: "66bb4f8b683bb83a83c26111",
        fileType: "CSV",
        feedType: "PRODUCT_LISTING",
        checksum: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        storageObjectKey: "safe-example/feed.csv",
        mappingVersion: "catalog-map/v1",
      },
      execution: {
        correlationId: "44444444-4444-4444-8444-444444444444",
        actorType: "SYSTEM",
        actorService: "web-bff",
      },
    };
    expect(publishedSchema).toMatchObject({
      $id: "https://catalogguard.local/contracts/v1/validation-job-request.schema.json",
      additionalProperties: false,
    });
    expect(validationJobRequestSchema.parse(request)).toEqual(request);
    expect(validationJobRequestSchema.safeParse({ ...request, unsupported: true }).success).toBe(false);
  });

  it("accepts Orchestration's signed fixture once, audits it, and rejects a replay", async () => {
    const fixture = await readFile(`${fixtureRoot}validation-job-result.v1.json`, "utf8");
    const result = validationJobResultSchema.parse(JSON.parse(fixture));
    await FeedUploadModel.create({
      _id: result.feedUploadId,
      sellerId: result.sellerId,
      uploadedByUserId: "66bb4f8b683bb83a83c26110",
      fileName: "fixture.csv",
      storageObjectKey: "feeds/fixture.csv",
      fileType: "CSV",
      feedType: "PRODUCT_LISTING",
      checksum: result.checksum,
      fileSizeBytes: 100,
      mappingVersion: "catalog-map/v1",
      processingStatus: "PROCESSING",
      dispatchState: "ACCEPTED",
      jobId: result.jobId,
      idempotencyKey: result.idempotencyKey,
      correlationId: result.execution.correlationId,
      processedRows: 0,
      acceptedRows: 0,
      rejectedRows: 0,
      totalRows: null,
      processedAt: null,
    } as never);
    const body = new TextEncoder().encode(fixture);
    const timestamp = Math.floor(Date.now() / 1_000);
    const nonce = "11111111-1111-4111-8111-111111111111";
    const signature = signOrchestrationMessage({
      secret: process.env.ORCHESTRATION_CALLBACK_SIGNING_SECRET!,
      keyVersion: "orchestration-k1",
      serviceId: "validation-orchestrator",
      timestamp,
      nonce,
      method: "POST",
      path: "/api/internal/validation-results",
      body,
    });
    const headers = {
      "content-type": "application/json",
      "x-correlation-id": result.execution.correlationId,
      "x-catalogguard-key-version": "orchestration-k1",
      "x-catalogguard-service": "validation-orchestrator",
      "x-catalogguard-timestamp": String(timestamp),
      "x-catalogguard-nonce": nonce,
      "x-catalogguard-signature": signature,
    };

    const first = await acceptValidationResult(new Request("http://localhost:3000/api/internal/validation-results", { method: "POST", headers, body: fixture }));
    expect(first.status).toBe(204);
    expect(await AuditLogModel.exists({ action: "ORCHESTRATION_CALLBACK_ACCEPTED", entityId: result.feedUploadId })).toBeTruthy();
    expect(await ServiceMessageNonceModel.exists({ nonce })).toBeTruthy();

    const replay = await acceptValidationResult(new Request("http://localhost:3000/api/internal/validation-results", { method: "POST", headers, body: fixture }));
    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toMatchObject({ error: { code: "SERVICE_MESSAGE_REPLAYED" } });
  });

  it("rejects a signed callback that adds an unsupported field", async () => {
    const fixture = JSON.parse(await readFile(`${fixtureRoot}validation-job-result.v1.json`, "utf8")) as Record<string, unknown>;
    fixture.unsupportedAction = "approve";
    const bodyText = JSON.stringify(fixture);
    const body = new TextEncoder().encode(bodyText);
    const timestamp = Math.floor(Date.now() / 1_000);
    const nonce = "22222222-2222-4222-8222-222222222222";
    const signature = signOrchestrationMessage({ secret: process.env.ORCHESTRATION_CALLBACK_SIGNING_SECRET!, keyVersion: "orchestration-k1", serviceId: "validation-orchestrator", timestamp, nonce, method: "POST", path: "/api/internal/validation-results", body });
    const response = await acceptValidationResult(new Request("http://localhost:3000/api/internal/validation-results", { method: "POST", headers: { "content-type": "application/json", "x-correlation-id": (fixture.execution as { correlationId: string }).correlationId, "x-catalogguard-key-version": "orchestration-k1", "x-catalogguard-service": "validation-orchestrator", "x-catalogguard-timestamp": String(timestamp), "x-catalogguard-nonce": nonce, "x-catalogguard-signature": signature }, body: bodyText }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "JOB_CONTRACT_INVALID" } });
  });
});
