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
        // Access token expired, check if refresh token exists
        // Token refresh will be handled by middleware or refresh action
        console.log("[AUTH] Access token expired, refresh token check needed");
      }
    }

    // Access token expired or missing, check if refresh token is valid
    // Note: We can't modify cookies here (Server Component limitation)
    // Token refresh should happen in middleware or via server action
    if (refreshTokenValue) {
      try {
        const refreshPayload = verifyRefreshToken(refreshTokenValue);
        // Refresh token is valid, return payload
        // Middleware will handle setting new access token
        console.log("[AUTH] Refresh token valid, returning user (token refresh handled by middleware)");
        return refreshPayload;
      } catch (error) {
        // Refresh token is also invalid/expired
        console.log("[AUTH] Refresh token expired");
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("[AUTH] Error in getCurrentUser:", error);
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
