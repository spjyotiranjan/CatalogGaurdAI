import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "@/lib/contracts/errors";

export const orchestrationSigningHeaders = {
  keyVersion: "x-catalogguard-key-version",
  service: "x-catalogguard-service",
  timestamp: "x-catalogguard-timestamp",
  nonce: "x-catalogguard-nonce",
  signature: "x-catalogguard-signature",
} as const;

type SigningInput = {
  secret: string;
  keyVersion: string;
  serviceId: string;
  timestamp: number;
  nonce: string;
  method: string;
  path: string;
  body: Uint8Array;
};

function bodySha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function canonicalOrchestrationMessage(input: Omit<SigningInput, "secret">): Buffer {
  return Buffer.from([
    "v1",
    input.keyVersion,
    input.serviceId,
    String(input.timestamp),
    input.nonce,
    input.method.toUpperCase(),
    input.path,
    bodySha256(input.body),
  ].join("\n"), "utf8");
}

export function signOrchestrationMessage(input: SigningInput): string {
  return createHmac("sha256", input.secret)
    .update(canonicalOrchestrationMessage(input))
    .digest("hex");
}

export type VerifiedOrchestrationMessage = {
  keyVersion: string;
  serviceId: string;
  timestamp: number;
  nonce: string;
};

export function verifyOrchestrationMessage(input: {
  headers: Headers;
  body: Uint8Array;
  method: string;
  path: string;
  expectedKeyVersion: string;
  expectedServiceId: string;
  signingSecret: string;
  maxClockSkewSeconds: number;
  now?: number;
}): VerifiedOrchestrationMessage {
  const keyVersion = input.headers.get(orchestrationSigningHeaders.keyVersion);
  const serviceId = input.headers.get(orchestrationSigningHeaders.service);
  const timestampHeader = input.headers.get(orchestrationSigningHeaders.timestamp);
  const nonce = input.headers.get(orchestrationSigningHeaders.nonce);
  const signature = input.headers.get(orchestrationSigningHeaders.signature);
  if (!keyVersion || !serviceId || !timestampHeader || !nonce || !signature) {
    throw new AppError({ code: "SERVICE_AUTHENTICATION_FAILED", message: "Service authentication failed.", status: 401 });
  }
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || !z.uuid().safeParse(nonce).success || keyVersion !== input.expectedKeyVersion || serviceId !== input.expectedServiceId || !/^[a-f\d]{64}$/i.test(signature)) {
    throw new AppError({ code: "SERVICE_AUTHENTICATION_FAILED", message: "Service authentication failed.", status: 401 });
  }
  if (Math.abs((input.now ?? Math.floor(Date.now() / 1000)) - timestamp) > input.maxClockSkewSeconds) {
    throw new AppError({ code: "SERVICE_MESSAGE_STALE", message: "The service message is outside the accepted time window.", status: 401 });
  }
  const expected = signOrchestrationMessage({ secret: input.signingSecret, keyVersion, serviceId, timestamp, nonce, method: input.method, path: input.path, body: input.body });
  const supplied = Buffer.from(signature, "hex");
  const calculated = Buffer.from(expected, "hex");
  if (supplied.length !== calculated.length || !timingSafeEqual(supplied, calculated)) {
    throw new AppError({ code: "SERVICE_AUTHENTICATION_FAILED", message: "Service authentication failed.", status: 401 });
  }
  return { keyVersion, serviceId, timestamp, nonce };
}
