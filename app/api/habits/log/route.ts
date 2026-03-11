/**
 * POST /api/habits/log
 * Log habit as done or skipped (used by notification action buttons).
 * Requires cookie auth.
 * Body: { habitId: string, status: "done" | "skipped", date?: string (YYYY-MM-DD) }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import connectDB from "@/lib/db";
import Habit from "@/models/Habit";
import HabitLog from "@/models/HabitLog";
import { updateHabitCompletionPercentage } from "@/app/actions/habits";
import mongoose from "mongoose";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const habitId = body?.habitId;
    const status = body?.status;
    if (!habitId || (status !== "done" && status !== "skipped")) {
      return NextResponse.json(
        { error: "habitId and status (done|skipped) are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const habit = await Habit.findOne({
      _id: habitId,
      userId: user.userId,
    });
    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    const logDate = body.date ? new Date(body.date) : new Date();
    logDate.setHours(0, 0, 0, 0);

    await HabitLog.findOneAndUpdate(
      {
        habitId: new mongoose.Types.ObjectId(habitId),
        userId: new mongoose.Types.ObjectId(user.userId),
        date: logDate,
      },
      {
        habitId: new mongoose.Types.ObjectId(habitId),
        userId: new mongoose.Types.ObjectId(user.userId),
        date: logDate,
        status,
      },
      { upsert: true, new: true }
    );

    await updateHabitCompletionPercentage(habitId, user.userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[habits/log]", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to log habit" },
      { status: 500 }
    );
  }
}
