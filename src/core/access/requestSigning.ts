import type { AccessActivation } from "../../app/preferencesStore";

export type AccessCredential = Pick<AccessActivation, "accessId" | "activationSecret" | "machineCode">;

export async function signApiRequest(options: {
  accessId: string;
  activationSecret: string;
  body: BodyInit | Uint8Array | null | undefined;
  machineCode: string;
  method: string;
  nonce?: string;
  pathWithQuery: string;
  timestamp?: string;
}): Promise<Record<string, string>> {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const nonce = options.nonce ?? crypto.randomUUID();
  const machineCode = options.machineCode.trim().toUpperCase();
  const bodyBytes = bodyToBytes(options.body);
  const bodyHash = await sha256Hex(bodyBytes);
  const canonical = [
    options.method.toUpperCase(),
    options.pathWithQuery,
    bodyHash,
    timestamp,
    nonce,
    machineCode
  ].join("\n");
  const signature = await hmacSha256Hex(options.activationSecret, canonical);
  return {
    "X-NN-Access-Id": options.accessId,
    "X-NN-Machine-Code": machineCode,
    "X-NN-Timestamp": timestamp,
    "X-NN-Nonce": nonce,
    "X-NN-Signature": signature
  };
}

export function bodyToBytes(body: BodyInit | Uint8Array | null | undefined): Uint8Array {
  if (!body) {
    return new Uint8Array();
  }
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }
  return new TextEncoder().encode(String(body));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return hex(new Uint8Array(digest));
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return hex(new Uint8Array(signature));
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
