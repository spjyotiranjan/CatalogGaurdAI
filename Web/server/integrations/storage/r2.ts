import "server-only";
import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@/lib/contracts/errors";
import { getFeedStorageEnvironment } from "@/server/config/env";

function client() {
  const config = getFeedStorageEnvironment();
  if (!config) throw new AppError({ code: "DEPENDENCY_UNAVAILABLE", message: "Private feed storage is not configured.", status: 503, retryable: true });
  return { config, s3: new S3Client({ region: "auto", endpoint: config.R2_ENDPOINT, credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY } }) };
}

export function createFeedObjectKey(sellerId: string, feedId: string): string { return `feeds/${sellerId}/${feedId}.csv`; }
export function checksumBytes(body: Uint8Array): string { return createHash("sha256").update(body).digest("hex"); }
export async function putPrivateCsv(input: { key: string; body: Uint8Array; checksum: string }): Promise<void> {
  const { config, s3 } = client();
  try { await s3.send(new PutObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: input.key, Body: input.body, ContentType: "text/csv", ChecksumSHA256: Buffer.from(input.checksum, "hex").toString("base64"), ServerSideEncryption: "AES256" })); }
  catch (cause) { throw new AppError({ code: "DEPENDENCY_UNAVAILABLE", message: "The feed could not be stored privately.", status: 503, retryable: true, cause }); }
}
export async function assertPrivateObject(input: { key: string; size: number; checksum: string }): Promise<void> {
  const { config, s3 } = client();
  try { const response = await s3.send(new HeadObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: input.key })); if (response.ContentLength !== input.size || (response.ChecksumSHA256 && response.ChecksumSHA256 !== Buffer.from(input.checksum, "hex").toString("base64"))) throw new Error("private object identity mismatch"); }
  catch (cause) { throw new AppError({ code: "DEPENDENCY_UNAVAILABLE", message: "The private feed object could not be verified.", status: 503, retryable: true, cause }); }
}
export async function createPrivateDownloadUrl(key: string): Promise<{ url: string; expiresAt: Date }> { const { config, s3 } = client(); const expiresAt = new Date(Date.now() + config.R2_DOWNLOAD_URL_TTL_SECONDS * 1000); try { return { url: await getSignedUrl(s3, new GetObjectCommand({ Bucket: config.R2_BUCKET_NAME, Key: key, ResponseContentType: "text/csv" }), { expiresIn: config.R2_DOWNLOAD_URL_TTL_SECONDS }), expiresAt }; } catch (cause) { throw new AppError({ code: "DEPENDENCY_UNAVAILABLE", message: "The private download could not be prepared.", status: 503, retryable: true, cause }); } }
