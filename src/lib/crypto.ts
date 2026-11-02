const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (passphrase.length < 8) {
    throw new Error("عبارة الاسترداد يجب ألا تقل عن 8 أحرف");
  }
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 210_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedBlob {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

export async function encryptJson(payload: unknown, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter: 210_000,
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(ct),
  };
}

export async function decryptJson<T>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  if (!blob || blob.v !== 1 || !blob.salt || !blob.iv || !blob.ct) {
    throw new Error("ملف النسخة الاحتياطية تالف أو غير معروف");
  }
  const salt = fromB64(blob.salt);
  const iv = fromB64(blob.iv);
  const ct = fromB64(blob.ct);
  const key = await deriveKey(passphrase, salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
    return JSON.parse(decoder.decode(pt)) as T;
  } catch {
    throw new Error("عبارة الاسترداد غير صحيحة أو الملف تالف");
  }
}

export async function hashPin(pin: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("رمز PIN من 4 إلى 8 أرقام");
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    material,
    256,
  );
  return { hash: toB64(bits), salt: toB64(salt) };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const next = await hashPin(pin, salt);
  return next.hash === hash;
}

export function blobToBytes(blob: EncryptedBlob): Uint8Array {
  return encoder.encode(JSON.stringify(blob));
}

export function bytesToText(bytes: ArrayBuffer): string {
  return decoder.decode(bytes);
}
