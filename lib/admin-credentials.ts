import { createHash, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const SCRYPT_KEY_LENGTH = 64;

export async function verifyAdminCredentials(username: string, password: string) {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const encodedPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUsername || !encodedPasswordHash) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD_HASH must be configured on the server.");
  }

  const [algorithm, saltText, hashText, extra] = encodedPasswordHash.split("$");
  if (algorithm !== "scrypt" || !saltText || !hashText || extra !== undefined) {
    throw new Error("ADMIN_PASSWORD_HASH has an invalid format.");
  }

  const salt = Buffer.from(saltText, "base64url");
  const expectedPasswordHash = Buffer.from(hashText, "base64url");
  if (salt.length < 16 || expectedPasswordHash.length !== SCRYPT_KEY_LENGTH) {
    throw new Error("ADMIN_PASSWORD_HASH has invalid salt or digest length.");
  }

  const actualPasswordHash = await scrypt(password, salt, SCRYPT_KEY_LENGTH) as Buffer;
  const passwordMatches = timingSafeEqual(actualPasswordHash, expectedPasswordHash);
  const usernameMatches = timingSafeEqual(
    createHash("sha256").update(username, "utf8").digest(),
    createHash("sha256").update(expectedUsername, "utf8").digest(),
  );
  return passwordMatches && usernameMatches;
}
