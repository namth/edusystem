export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp?: number;
}

const JWT_SECRET_STRING =
  process.env.JWT_SECRET || "edutest_pro_super_secret_jwt_key_2026_change_in_production_32chars!";

const JWT_SECRET_BYTES = new TextEncoder().encode(JWT_SECRET_STRING);

async function getHmacKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    JWT_SECRET_BYTES,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function signJwtToken(payload: TokenPayload, expiresInDays: number = 7): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const nowInSec = Math.floor(Date.now() / 1000);
  const expInSec = nowInSec + expiresInDays * 24 * 60 * 60;

  const fullPayload = {
    ...payload,
    iat: nowInSec,
    exp: expInSec,
  };

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(dataToSign)
  );

  const signature = base64UrlEncode(signatureBuffer);
  return `${dataToSign}.${signature}`;
}

export async function verifyJwtToken(token: string): Promise<TokenPayload | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await getHmacKey();
    let sigBase64 = signature.replace(/-/g, "+").replace(/_/g, "/");
    while (sigBase64.length % 4) {
      sigBase64 += "=";
    }
    const binarySig = atob(sigBase64);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(dataToSign)
    );

    if (!isValid) return null;

    const payloadJson = JSON.parse(base64UrlDecode(encodedPayload));
    const nowInSec = Math.floor(Date.now() / 1000);

    if (payloadJson.exp && nowInSec > payloadJson.exp) {
      return null; // Expired
    }

    return {
      userId: payloadJson.userId,
      email: payloadJson.email,
      role: payloadJson.role,
      exp: payloadJson.exp,
    };
  } catch (err) {
    return null;
  }
}
