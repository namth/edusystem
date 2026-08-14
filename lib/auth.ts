import crypto from "crypto";
import { cookies } from "next/headers";
import { signJwtToken, verifyJwtToken, TokenPayload } from "./jwt";

export type { TokenPayload };
export { signJwtToken, verifyJwtToken };

// 1. Native Node.js Crypto Salted Password Hashing (OWASP Standard scrypt)
export function hashPassword(plainText: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(plainText, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function comparePassword(plainText: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) {
    // Legacy unhashed or plaintext fallback comparison
    return storedHash === plainText;
  }

  try {
    const [salt, key] = storedHash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(plainText, salt, 64);

    if (keyBuffer.length !== derivedKey.length) {
      return false;
    }
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    return false;
  }
}

// 2. HTTP-Only Auth Cookie Management for Server API Routes
export async function setAuthCookie(payload: TokenPayload) {
  const token = await signJwtToken(payload);
  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  return token;
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthenticatedUserFromCookie(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return await verifyJwtToken(token);
}
