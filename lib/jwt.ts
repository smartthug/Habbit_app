import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret-change-in-production";

// Validate secrets are set
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "fallback-secret-change-in-production") {
  console.warn("[JWT] WARNING: JWT_SECRET is using fallback value. Set JWT_SECRET in .env.local");
}

if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === "fallback-refresh-secret-change-in-production") {
  console.warn("[JWT] WARNING: JWT_REFRESH_SECRET is using fallback value. Set JWT_REFRESH_SECRET in .env.local");
}

export interface TokenPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: "15m",
    });
    console.log("[JWT] Access token generated, length:", token.length);
    return token;
  } catch (error) {
    console.error("[JWT] Error generating access token:", error);
    throw error;
  }
}

export function generateRefreshToken(payload: TokenPayload): string {
  try {
    const token = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: "25d",
    });
    console.log("[JWT] Refresh token generated, length:", token.length);
    return token;
  } catch (error) {
    console.error("[JWT] Error generating refresh token:", error);
    throw error;
  }
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return payload;
  } catch (error: any) {
    console.error("[JWT] Token verification failed:", error.message);
    throw new Error("Invalid or expired token");
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
}
