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
        // Access token expired or invalid, check if refresh token is valid
        if (refreshTokenValue) {
          try {
            const refreshPayload = verifyRefreshToken(refreshTokenValue);
            // Refresh token is valid, return user
            // Note: Token refresh happens via refreshToken action or API route
            return refreshPayload;
          } catch (error) {
            // Both tokens are invalid/expired - clear cookies
            // Note: We can't modify cookies in this function (server component context)
            // Middleware or API routes will handle cookie clearing
            return null;
          }
        } else {
          // Access token invalid and no refresh token
          return null;
        }
      }
    } else if (refreshTokenValue) {
      // No access token, check refresh token
      try {
        const refreshPayload = verifyRefreshToken(refreshTokenValue);
        // Refresh token is valid, return user
        return refreshPayload;
      } catch (error) {
        // Refresh token expired or invalid
        return null;
      }
    }

    return null;
  } catch (error) {
    // Any error in token verification means user is not authenticated
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
