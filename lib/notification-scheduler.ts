/**
 * Server-side notification scheduling logic.
 * Used by the cron API route to determine what to send to each user.
 */
import connectDB from "@/lib/db";
import FCMToken from "@/models/FCMToken";
import NotificationSent from "@/models/NotificationSent";
import Habit from "@/models/Habit";
import HabitLog from "@/models/HabitLog";
import Calendar from "@/models/Calendar";
import mongoose from "mongoose";

/** Current time in HH:mm (e.g. "18:30") */
function getCurrentTimeString(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse HH:mm to minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True if current time (HH:mm) is inside [start, end] (inclusive). Handles overnight. */
function isTimeInRange(nowMinutes: number, startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end >= start) {
    return nowMinutes >= start && nowMinutes <= end;
  }
  return nowMinutes >= start || nowMinutes <= end;
}

function shouldHabitOccurOnDate(habit: { frequency: string; dayOfWeek?: number; dayOfMonth?: number; month?: number; createdAt?: Date; timeline?: number }, date: Date): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly" && habit.dayOfWeek !== undefined) return d.getDay() === habit.dayOfWeek;
  if (habit.frequency === "monthly" && habit.dayOfMonth !== undefined) {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(habit.dayOfMonth, last);
  }
  if (habit.frequency === "yearly" && habit.month !== undefined && habit.dayOfMonth !== undefined) {
    const last = new Date(d.getFullYear(), habit.month + 1, 0).getDate();
    return d.getMonth() === habit.month && d.getDate() === Math.min(habit.dayOfMonth, last);
  }
  return false;
}

function isWithinTimeline(habit: { timeline?: number; createdAt?: Date }, date: Date): boolean {
  if (!habit.timeline || !habit.createdAt) return true;
  const start = new Date(habit.createdAt);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + habit.timeline);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d >= start && d < end;
}

const todayDateString = () => new Date().toISOString().slice(0, 10);

export interface HabitNotificationItem {
  type: "habit";
  habitId: string;
  name: string;
  priority: string;
}

export interface TodoNotificationItem {
  type: "todo";
  eventId: string;
  title: string;
  message: string;
}

export interface MeetingNotificationItem {
  type: "meeting";
  eventId: string;
  title: string;
  description: string;
}

export interface BirthdayNotificationItem {
  type: "birthday";
  eventId: string;
  title: string;
  message: string;
}

export type NotificationItem =
  | HabitNotificationItem
  | TodoNotificationItem
  | MeetingNotificationItem
  | BirthdayNotificationItem;

export interface UserNotifications {
  userId: string;
  tokens: string[];
  items: NotificationItem[];
}

/**
 * Fetch all users that have at least one FCM token, with their tokens.
 */
export async function getUsersWithFCMTokens(): Promise<{ userId: string; tokens: string[] }[]> {
  await connectDB();
  const rows = await FCMToken.aggregate<{ _id: mongoose.Types.ObjectId; tokens: string[] }>([
    { $group: { _id: "$userId", tokens: { $push: "$token" } } },
  ]);
  return rows.map((r) => ({ userId: r._id.toString(), tokens: r.tokens }));
}

/**
 * Check if we already sent this notification today (for dedup).
 */
async function wasSent(userId: string, type: NotificationSentType, refId: string): Promise<boolean> {
  const date = todayDateString();
  const sent = await NotificationSent.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    type,
    refId: new mongoose.Types.ObjectId(refId),
    date,
  });
  return !!sent;
}

type NotificationSentType = "habit" | "todo" | "meeting" | "birthday";

async function markSent(userId: string, type: NotificationSentType, refId: string): Promise<void> {
  const date = todayDateString();
  await NotificationSent.findOneAndUpdate(
    {
      userId: new mongoose.Types.ObjectId(userId),
      type,
      refId: new mongoose.Types.ObjectId(refId),
      date,
    },
    { $set: { sentAt: new Date() } },
    { upsert: true }
  );
}

/**
 * Get habit reminders for this user: habits that have startTime/endTime,
 * occur today, and current time is inside the window. Not yet sent today.
 */
async function getHabitReminders(userId: string): Promise<HabitNotificationItem[]> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTime = getCurrentTimeString();

  const habits = await Habit.find({
    userId: new mongoose.Types.ObjectId(userId),
    startTime: { $exists: true, $ne: "" },
    endTime: { $exists: true, $ne: "" },
  }).lean();

  const logs = await HabitLog.find({
    userId: new mongoose.Types.ObjectId(userId),
    date: today,
  }).lean();
  const doneHabitIds = new Set(logs.map((l: any) => l.habitId.toString()));

  const out: HabitNotificationItem[] = [];
  for (const habit of habits) {
    if (doneHabitIds.has(habit._id.toString())) continue;
    if (!shouldHabitOccurOnDate(habit, now)) continue;
    if (!isWithinTimeline(habit, now)) continue;
    if (!isTimeInRange(nowMinutes, habit.startTime!, habit.endTime!)) continue;
    if (await wasSent(userId, "habit", habit._id.toString())) continue;
    out.push({
      type: "habit",
      habitId: habit._id.toString(),
      name: habit.name,
      priority: habit.priority ?? "low",
    });
  }
  return out;
}

/**
 * Get todo reminders: todos with reminder enabled where (event time - minutesBefore) is now.
 */
async function getTodoReminders(userId: string): Promise<TodoNotificationItem[]> {
  const now = new Date();
  const start = new Date(now);
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 1);

  const events = await Calendar.find({
    userId: new mongoose.Types.ObjectId(userId),
    type: "todo",
    "reminder.enabled": true,
  }).lean();

  const out: TodoNotificationItem[] = [];
  for (const ev of events) {
    const eventDate = new Date(ev.date);
    if (ev.time) {
      const [h, m] = ev.time.split(":").map(Number);
      eventDate.setHours(h ?? 0, m ?? 0, 0, 0);
    } else {
      eventDate.setHours(9, 0, 0, 0);
    }
    const reminderTime = new Date(eventDate);
    reminderTime.setMinutes(reminderTime.getMinutes() - (ev.reminder?.minutesBefore ?? 15));
    if (reminderTime < end && reminderTime >= start) {
      if (await wasSent(userId, "todo", ev._id.toString())) continue;
      out.push({
        type: "todo",
        eventId: ev._id.toString(),
        title: ev.title,
        message: ev.description || `Reminder: ${ev.title}`,
      });
    }
  }
  return out;
}

/**
 * Get meeting notifications: meetings whose date+time is right now (within this minute).
 */
async function getMeetingReminders(userId: string): Promise<MeetingNotificationItem[]> {
  const now = new Date();
  const start = new Date(now);
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 1);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const events = await Calendar.find({
    userId: new mongoose.Types.ObjectId(userId),
    type: "meeting",
    date: { $gte: todayStart, $lt: todayEnd },
  }).lean();

  const out: MeetingNotificationItem[] = [];
  for (const ev of events) {
    const eventDate = new Date(ev.date);
    const [h, m] = ev.time ? ev.time.split(":").map(Number) : [9, 0];
    eventDate.setHours(h ?? 9, m ?? 0, 0, 0);
    if (eventDate >= start && eventDate < end && !(await wasSent(userId, "meeting", ev._id.toString()))) {
      out.push({
        type: "meeting",
        eventId: ev._id.toString(),
        title: ev.title,
        description: ev.description || "",
      });
    }
  }
  return out;
}

/**
 * Get birthday notifications: calendar events type=birthday with date = today.
 */
async function getBirthdayReminders(userId: string): Promise<BirthdayNotificationItem[]> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const events = await Calendar.find({
    userId: new mongoose.Types.ObjectId(userId),
    type: "birthday",
    date: { $gte: start, $lt: end },
  }).lean();

  const out: BirthdayNotificationItem[] = [];
  for (const ev of events) {
    if (await wasSent(userId, "birthday", ev._id.toString())) continue;
    const name = ev.title?.replace(/'s Birthday$/, "") || "Someone";
    out.push({
      type: "birthday",
      eventId: ev._id.toString(),
      title: ev.title || "Birthday",
      message: `Today is ${name}'s Birthday 🎉`,
    });
  }
  return out;
}

/**
 * Build list of notifications to send for each user (with FCM tokens).
 */
export async function buildNotificationsForAllUsers(): Promise<UserNotifications[]> {
  const users = await getUsersWithFCMTokens();
  const result: UserNotifications[] = [];

  for (const { userId, tokens } of users) {
    const [habits, todos, meetings, birthdays] = await Promise.all([
      getHabitReminders(userId),
      getTodoReminders(userId),
      getMeetingReminders(userId),
      getBirthdayReminders(userId),
    ]);
    const items: NotificationItem[] = [...habits, ...todos, ...meetings, ...birthdays];
    if (items.length > 0) {
      result.push({ userId, tokens, items });
    }
  }
  return result;
}

/**
 * Mark a notification as sent (call after successfully sending FCM).
 */
export async function markNotificationSent(
  userId: string,
  type: NotificationSentType,
  refId: string
): Promise<void> {
  await markSent(userId, type, refId);
}
