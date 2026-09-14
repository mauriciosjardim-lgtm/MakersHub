import { Buffer } from "node:buffer";
import { CalendarError } from "./protocol";

export function randomSecret(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}
export async function sha256(value: string): Promise<string> {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ).toString("base64url");
}
async function importKey(value: string) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new CalendarError("configuration_missing", 503);
  const bytes = new Uint8Array(Buffer.from(value, "base64"));
  if (bytes.length !== 32) throw new CalendarError("configuration_missing", 503);
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function seal(value: unknown, key: string, context: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) },
    await importKey(key),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `v1.${Buffer.from(iv).toString("base64url")}.${Buffer.from(ciphertext).toString("base64url")}`;
}
export async function unseal(value: string, key: string, context: string): Promise<unknown> {
  try {
    const [version, iv, ciphertext, extra] = value.split(".");
    if (
      version !== "v1" ||
      !iv ||
      !ciphertext ||
      extra ||
      Buffer.from(iv, "base64url").length !== 12
    )
      throw new Error();
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(Buffer.from(iv, "base64url")),
        additionalData: new TextEncoder().encode(context),
      },
      await importKey(key),
      new Uint8Array(Buffer.from(ciphertext, "base64url")),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new CalendarError("credentials_unavailable", 503);
  }
}
export const tokenContext = (userId: string, empresaId: string, generation: string) =>
  `google-calendar:tokens:${userId}:${empresaId}:${generation}`;
export const stateContext = (hash: string) => `google-calendar:state:${hash}`;
