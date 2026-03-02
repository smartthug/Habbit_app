import { cookies } from "next/headers";
import { verifyAccessToken, verifyRefreshToken, TokenPayload } from "./jwt";

export async function getCurrentUser(): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    const refreshTokenValue = cookieStore.get("refreshToken")?.value;

    // If no tokens at all, user is not authenticated
    if (!accessToken && !refreshTokenValue) {
      return null;
    }

    // Try to verify access token first
    if (accessToken) {
      try {
        const payload = verifyAccessToken(accessToken);
        return payload;
      } catch (error) {
        // Access token expired, check if refresh token is valid
        // Token refresh will be handled by refreshToken server action or middleware
        if (refreshTokenValue) {
          try {
            const refreshPayload = verifyRefreshToken(refreshTokenValue);
            // Refresh token is valid, return user
            // Note: Token refresh happens in middleware or via refreshToken action
            return refreshPayload;
          } catch (error) {
            // Refresh token is also invalid/expired
            return null;
          }
        }
      }
    } else if (refreshTokenValue) {
      // No access token, check refresh token
      try {
        const refreshPayload = verifyRefreshToken(refreshTokenValue);
        // Refresh token is valid, return user
        return refreshPayload;
      } catch (error) {
        // Refresh token expired
        return null;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

export async function requireAuth(): Promise<TokenPayload> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
