import { accountResponseSchema, type AccountResponse } from "@/lib/contracts/account";
import { passwordChangeSchema } from "@/lib/contracts/auth";
import { errorEnvelopeSchema, type ErrorEnvelope } from "@/lib/contracts/errors";

export class AccountClientError extends Error {
  constructor(
    message: string,
    readonly envelope: ErrorEnvelope | null = null,
  ) {
    super(message);
    this.name = "AccountClientError";
  }
}

async function parseError(response: Response): Promise<AccountClientError> {
  const payload = errorEnvelopeSchema.safeParse(await response.json().catch(() => null));
  return new AccountClientError(
    payload.success ? payload.data.error.message : "The request could not be completed.",
    payload.success ? payload.data : null,
  );
}

/** Reads the current account through the BFF using its exported response contract. */
export async function fetchCurrentAccount(): Promise<AccountResponse> {
  const response = await fetch("/api/account", { cache: "no-store" });
  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = accountResponseSchema.safeParse(await response.json());
  if (!payload.success) {
    throw new AccountClientError("The account service returned an unexpected response.");
  }
  return payload.data;
}

/** Sends only the password-change shape accepted by the BFF's Zod contract. */
export async function changeCurrentPassword(input: unknown): Promise<void> {
  const payload = passwordChangeSchema.safeParse(input);
  if (!payload.success) {
    const fieldErrors = payload.error.flatten().fieldErrors;
    throw new AccountClientError("Check the password requirements.", {
      error: {
        code: "VALIDATION_FAILED",
        message: "Check the password requirements.",
        correlationId: crypto.randomUUID(),
        retryable: false,
        fieldErrors,
      },
    });
  }

  const response = await fetch("/api/account/password", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload.data),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
}
