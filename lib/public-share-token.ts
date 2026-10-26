import { createHash, randomBytes } from "node:crypto";

export function createPublicShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPublicShareToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
