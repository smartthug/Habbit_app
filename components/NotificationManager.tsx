"use client";

import { useEffect, useState, useRef } from "react";
import { getTodayHabits } from "@/app/actions/habits";
import { getCalendarEvents } from "@/app/actions/calendar";
import { getFCMToken, onForegroundMessage } from "@/lib/firebase-client";

/**
 * NotificationManager: in-app reminders + FCM push registration.
 * - Registers FCM token with the backend for server-triggered push (habits, todos, meetings, birthdays).
 * - Handles foreground FCM messages and URL params from notification action clicks (Complete/Skip).
 * - Keeps legacy in-app checks for incomplete habits and calendar reminders when app is open.
 */
export function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [checkedToday, setCheckedToday] = useState(false);
  const registeredRef = useRef(false);

  // --- FCM: register token and handle notification redirect (habit action) ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Handle redirect from notification action (Complete/Skip): call log API and clean URL
    const params = new URLSearchParams(window.location.search);
    const habitAction = params.get("habitAction");
    const habitId = params.get("habitId");
    if (habitAction && habitId && (habitAction === "complete" || habitAction === "skip")) {
      const status = habitAction === "complete" ? "done" : "skipped";
      fetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ habitId, status }),
      })
        .then(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("habitAction");
          url.searchParams.delete("habitId");
          url.searchParams.delete("from");
          window.history.replaceState({}, "", url.pathname + url.search);
        })
        .catch((err) => console.error("[NotificationManager] habit log error:", err));
    }

    // Register FCM token with backend (once per session). Delay so SW is fully active.
    async function registerFCM() {
      if (registeredRef.current) return;
      const token = await getFCMToken();
      if (!token) return;
      try {
        const res = await fetch("/api/notifications/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        if (res.ok) registeredRef.current = true;
      } catch (e) {
        console.warn("[NotificationManager] FCM register failed:", e);
      }
    }

    let cancelSchedule: (() => void) | null = null;
    function scheduleFCMRegister() {
      const t = setTimeout(() => {
        if (Notification.permission === "granted") registerFCM();
      }, 2500);
      cancelSchedule = () => clearTimeout(t);
    }

    if (Notification.permission === "granted") {
      scheduleFCMRegister();
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        setPermission(perm);
        if (perm === "granted") scheduleFCMRegister();
      });
    } else if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    // Foreground FCM messages: show in-app notification
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || "Notification";
      const body = payload.notification?.body || payload.data?.message || payload.data?.body || "";
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico", tag: "fcm-foreground" });
      }
    });
    return () => {
      cancelSchedule?.();
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // --- Legacy: incomplete habits check (after 9 PM) ---
  useEffect(() => {
    checkIncompleteHabits();
    const habitCheckInterval = setInterval(checkIncompleteHabits, 3600000);
    return () => clearInterval(habitCheckInterval);
  }, [permission]);

  // --- Legacy: calendar reminders (every minute when app is open) ---
  useEffect(() => {
    checkCalendarReminders();
    const reminderInterval = setInterval(checkCalendarReminders, 60000);
    return () => clearInterval(reminderInterval);
  }, [permission]);

  async function checkIncompleteHabits() {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 21 && !checkedToday) {
      try {
        const result = await getTodayHabits();
        if (result.success) {
          const incompleteHabits = result.habits.filter(
            (habit: any) => habit.todayStatus !== "done" && habit.frequency === "daily"
          );
          if (incompleteHabits.length > 0 && permission === "granted") {
            new Notification("Incomplete Habits Reminder", {
              body: `You have ${incompleteHabits.length} incomplete habit${incompleteHabits.length > 1 ? "s" : ""} today: ${incompleteHabits.slice(0, 3).map((h: any) => h.name).join(", ")}${incompleteHabits.length > 3 ? "..." : ""}`,
              icon: "/favicon.ico",
              tag: "incomplete-habits",
            });
            setCheckedToday(true);
          }
        }
      } catch (error) {
        console.error("Error checking incomplete habits:", error);
      }
    }
    if (hour === 0) setCheckedToday(false);
  }

  async function checkCalendarReminders() {
    if (permission !== "granted") return;
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      const result = await getCalendarEvents(now.toISOString(), tomorrow.toISOString());
      if (!result.success) return;
      result.events.forEach((event: any) => {
        if (!event.reminder?.enabled) return;
        const eventDate = new Date(event.date);
        if (event.time) {
          const [hours, minutes] = event.time.split(":").map(Number);
          eventDate.setHours(hours, minutes, 0, 0);
        } else {
          eventDate.setHours(9, 0, 0, 0);
        }
        const reminderTime = new Date(eventDate);
        reminderTime.setMinutes(reminderTime.getMinutes() - (event.reminder.minutesBefore || 15));
        const timeDiff = reminderTime.getTime() - now.getTime();
        if (timeDiff > 0 && timeDiff <= 60000) {
          const notificationKey = `reminder-${event._id}-${reminderTime.getTime()}`;
          if (!localStorage.getItem(notificationKey)) {
            new Notification(event.title, {
              body: event.description || `Event ${event.time ? `at ${event.time}` : "today"}${event.location ? ` at ${event.location}` : ""}`,
              icon: "/favicon.ico",
              tag: `calendar-reminder-${event._id}`,
            });
            localStorage.setItem(notificationKey, "sent");
            setTimeout(() => localStorage.removeItem(notificationKey), 86400000);
          }
        }
      });
    } catch (error) {
      console.error("Error checking calendar reminders:", error);
    }
  }

  return null;
}
