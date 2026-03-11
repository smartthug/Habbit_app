/**
 * POST /api/notifications/register
 * Register FCM token for the current user (cookie auth).
 * Body: { token: string, deviceLabel?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import connectDB from "@/lib/db";
import FCMToken from "@/models/FCMToken";
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    await connectDB();

    await FCMToken.findOneAndUpdate(
      { token },
      {
        userId: new mongoose.Types.ObjectId(user.userId),
        token,
        deviceLabel: body.deviceLabel ?? undefined,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[notifications/register]", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to register token" },
      { status: 500 }
    );
  }
}
