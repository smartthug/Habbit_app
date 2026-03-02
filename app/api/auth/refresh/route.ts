import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyRefreshToken, generateAccessToken } from "@/lib/jwt";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      const newAccessToken = generateAccessToken({
        userId: payload.userId,
        email: payload.email,
      });

      cookieStore.set("accessToken", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 15, // 15 minutes
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      cookieStore.delete("accessToken");
      cookieStore.delete("refreshToken");
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Token refresh failed" }, { status: 500 });
  }
}
