/**
 * POST /api/notifications/trigger
 * Cron endpoint: evaluates habits/todos/meetings/birthdays and sends FCM push notifications.
 * Secured by CRON_SECRET query param or header.
 * Call every 1–5 minutes (e.g. Vercel Cron or external cron).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildNotificationsForAllUsers,
  markNotificationSent,
  type NotificationItem,
  type HabitNotificationItem,
  type TodoNotificationItem,
  type MeetingNotificationItem,
  type BirthdayNotificationItem,
} from "@/lib/notification-scheduler";
import { sendFCMToTokens } from "@/lib/firebase-admin";
import FCMToken from "@/models/FCMToken";
import connectDB from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const querySecret = request.nextUrl.searchParams.get("secret");
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return [querySecret, headerSecret, bearerSecret].includes(CRON_SECRET);
}

function buildPayload(item: NotificationItem): { data: Record<string, string>; title: string; body: string } {
  switch (item.type) {
    case "habit": {
      const h = item as HabitNotificationItem;
      return {
        data: {
          type: "habit",
          habitId: h.habitId,
          habitName: h.name,
          priority: h.priority,
          showSkip: h.priority !== "high" ? "true" : "false",
        },
        title: "Habit Reminder",
        body: h.name,
      };
    }
    case "todo": {
      const t = item as TodoNotificationItem;
      return {
        data: {
          type: "todo",
          eventId: t.eventId,
          title: t.title,
          message: t.message,
        },
        title: t.title,
        body: t.message,
      };
    }
    case "meeting": {
      const m = item as MeetingNotificationItem;
      return {
        data: {
          type: "meeting",
          eventId: m.eventId,
          title: m.title,
          description: m.description,
        },
        title: m.title,
        body: m.description || "Meeting starting now",
      };
    }
    case "birthday": {
      const b = item as BirthdayNotificationItem;
      return {
        data: {
          type: "birthday",
          eventId: b.eventId,
          title: b.title,
          message: b.message,
        },
        title: b.title,
        body: b.message,
      };
    }
    default:
      return { data: {}, title: "Notification", body: "" };
  }
}

function getRefId(item: NotificationItem): string {
  switch (item.type) {
    case "habit":
      return (item as HabitNotificationItem).habitId;
    case "todo":
      return (item as TodoNotificationItem).eventId;
    case "meeting":
      return (item as MeetingNotificationItem).eventId;
    case "birthday":
      return (item as BirthdayNotificationItem).eventId;
    default:
      return "";
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const batches = await buildNotificationsForAllUsers();
    let sent = 0;
    const invalidTokens: string[] = [];

    for (const { userId, tokens, items } of batches) {
      for (const item of items) {
        const { data, title, body } = buildPayload(item);
        try {
          const { failed } = await sendFCMToTokens(tokens, data, { title, body });
          invalidTokens.push(...failed);
          if (failed.length < tokens.length) {
            await markNotificationSent(userId, item.type, getRefId(item));
            sent++;
          }
        } catch (err) {
          console.error("[notifications/trigger] Send error for user", userId, err);
        }
      }
    }

    if (invalidTokens.length > 0) {
      await connectDB();
      await FCMToken.deleteMany({ token: { $in: invalidTokens } });
    }

    return NextResponse.json({ success: true, notificationsSent: sent, invalidTokensRemoved: invalidTokens.length });
  } catch (error: any) {
    console.error("[notifications/trigger]", error);
    return NextResponse.json(
      { error: error?.message ?? "Trigger failed" },
      { status: 500 }
    );
  }
}

/** Allow GET for simple cron HTTP GET (e.g. cron-job.org) */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return POST(request);
}
