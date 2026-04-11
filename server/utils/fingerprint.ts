import { createHash } from "node:crypto";

export function normalizeFingerprintHash(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new Error("Invalid fingerprint");
  }
  return createHash("sha256").update(value).digest("hex");
}
