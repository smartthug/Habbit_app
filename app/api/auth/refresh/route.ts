import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyRefreshToken, generateAccessToken } from "@/lib/jwt";

/**
 * API route to refresh access token using refresh token
 * Clears invalid cookies and sets new access token if refresh token is valid
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken || refreshToken.length === 0) {
      // Clear any invalid cookies
      const response = NextResponse.json({ error: "No refresh token" }, { status: 401 });
      response.cookies.delete("accessToken");
      response.cookies.delete("refreshToken");
      return response;
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      const newAccessToken = generateAccessToken({
        userId: payload.userId,
        email: payload.email,
      });

      // Set new access token
      cookieStore.set("accessToken", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 15, // 15 minutes
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      // Refresh token is invalid - clear all auth cookies
      const response = NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
      response.cookies.delete("accessToken");
      response.cookies.delete("refreshToken");
      return response;
    }
  } catch (error: any) {
    // Clear cookies on any error
    const response = NextResponse.json({ error: error.message || "Token refresh failed" }, { status: 500 });
    response.cookies.delete("accessToken");
    response.cookies.delete("refreshToken");
    return response;
  }
}
