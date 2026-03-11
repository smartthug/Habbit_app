/**
 * POST /api/notifications/unregister
 * Remove FCM token (e.g. on logout).
 * Body: { token: string }
 */
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import FCMToken from "@/models/FCMToken";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    await connectDB();
    await FCMToken.deleteOne({ token });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[notifications/unregister]", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to unregister token" },
      { status: 500 }
    );
  }
}
