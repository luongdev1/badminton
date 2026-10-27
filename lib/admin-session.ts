export const ADMIN_SESSION_COOKIE = "rallyteam-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const SESSION_VERSION = 1;
const encoder = new TextEncoder();

type AdminSessionPayload = {
  exp: number;
  iat: number;
  sub: "admin";
  v: 1;
};

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url value.");
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSigningKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  }
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createAdminSessionToken(now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload: AdminSessionPayload = {
    exp: issuedAt + ADMIN_SESSION_MAX_AGE_SECONDS,
    iat: issuedAt,
    sub: "admin",
    v: SESSION_VERSION,
  };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await getSigningKey(), encoder.encode(encodedPayload));
  return `${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(token: string | undefined, now = Date.now()) {
  if (!token || token.length > 1024) return false;
  const [encodedPayload, encodedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra.length > 0) return false;

  try {
    const key = await getSigningKey();
    const signatureIsValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(encodedSignature),
      encoder.encode(encodedPayload),
    );
    if (!signatureIsValid) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as Partial<AdminSessionPayload>;
    const currentTime = Math.floor(now / 1000);
    return payload.v === SESSION_VERSION
      && payload.sub === "admin"
      && Number.isSafeInteger(payload.iat)
      && Number.isSafeInteger(payload.exp)
      && (payload.iat as number) <= currentTime + 60
      && (payload.exp as number) > currentTime
      && (payload.exp as number) - (payload.iat as number) <= ADMIN_SESSION_MAX_AGE_SECONDS;
  } catch {
    return false;
  }
}
