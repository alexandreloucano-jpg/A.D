import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ServiceError } from "./store.js";
function key() {
  const bytes = Buffer.from(
    process.env.AD_TOKEN_ENCRYPTION_KEY || "",
    "base64",
  );
  if (bytes.length !== 32)
    throw new ServiceError(503, "token_encryption_not_configured");
  return bytes;
}
export function encryptionAvailable() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}
export function seal(value: unknown, binding: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(binding));
  const content = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), content]
    .map((x) => x.toString("base64url"))
    .join(".");
}
export function unseal<T>(value: string, binding: string): T {
  try {
    const [iv, tag, content] = value
      .split(".")
      .map((x) => Buffer.from(x, "base64url"));
    const cipher = createDecipheriv("aes-256-gcm", key(), iv);
    cipher.setAAD(Buffer.from(binding));
    cipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([cipher.update(content), cipher.final()]).toString("utf8"),
    );
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError(503, "encrypted_connection_unreadable");
  }
}
