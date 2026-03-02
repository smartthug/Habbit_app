/**
 * JWT utilities for Edge Runtime (middleware)
 * Uses 'jose' library which works in Edge Runtime
 */
import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret-change-in-production";

export interface TokenPayload {
  userId: string;
  email: string;
  [key: string]: unknown; // Index signature for JWTPayload compatibility
}

// Create secret keys for Edge Runtime
function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function verifyAccessTokenEdge(token: string): Promise<TokenPayload> {
  try {
    const secretKey = getSecretKey(JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as TokenPayload;
  } catch (error: any) {
    throw new Error("Invalid or expired token");
  }
}

export async function verifyRefreshTokenEdge(token: string): Promise<TokenPayload> {
  try {
    const secretKey = getSecretKey(JWT_REFRESH_SECRET);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as TokenPayload;
  } catch (error: any) {
    throw new Error("Invalid or expired refresh token");
  }
}

export async function generateAccessTokenEdge(payload: TokenPayload): Promise<string> {
  try {
    const secretKey = getSecretKey(JWT_SECRET);
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secretKey);
    return token;
  } catch (error: any) {
    throw error;
  }
}
