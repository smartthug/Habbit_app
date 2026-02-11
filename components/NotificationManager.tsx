"use client";

import { useEffect, useState } from "react";
import { getTodayHabits } from "@/app/actions/habits";
import { getCalendarEvents } from "@/app/actions/calendar";

export function NotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [checkedToday, setCheckedToday] = useState(false);

  useEffect(() => {
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        setPermission(perm);
      });
    } else if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    // Check for incomplete habits at end of day (9 PM)
    checkIncompleteHabits();
    
    // Check for calendar reminders
    checkCalendarReminders();

    // Set up interval to check reminders every minute
    const reminderInterval = setInterval(() => {
      checkCalendarReminders();
    }, 60000); // Check every minute

    // Set up interval to check incomplete habits every hour
    const habitCheckInterval = setInterval(() => {
      checkIncompleteHabits();
    }, 3600000); // Check every hour

    return () => {
      clearInterval(reminderInterval);
      clearInterval(habitCheckInterval);
    };
  }, []);

  async function checkIncompleteHabits() {
    const now = new Date();
    const hour = now.getHours();
    
    // Only check once per day after 9 PM
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

    // Reset check flag at midnight
    if (hour === 0) {
      setCheckedToday(false);
    }
  }

  async function checkCalendarReminders() {
    if (permission !== "granted") return;

    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      const result = await getCalendarEvents(now.toISOString(), tomorrow.toISOString());
      
      if (result.success) {
        result.events.forEach((event: any) => {
          if (event.reminder?.enabled) {
            const eventDate = new Date(event.date);
            if (event.time) {
              const [hours, minutes] = event.time.split(":").map(Number);
              eventDate.setHours(hours, minutes, 0, 0);
            } else {
              eventDate.setHours(9, 0, 0, 0); // Default to 9 AM if no time
            }

            const reminderTime = new Date(eventDate);
            reminderTime.setMinutes(reminderTime.getMinutes() - (event.reminder.minutesBefore || 15));

            // Check if we're within 1 minute of the reminder time
            const timeDiff = reminderTime.getTime() - now.getTime();
            if (timeDiff > 0 && timeDiff <= 60000) {
              // Check if we've already sent this notification
              const notificationKey = `reminder-${event._id}-${reminderTime.getTime()}`;
              if (!localStorage.getItem(notificationKey)) {
                new Notification(event.title, {
                  body: event.description || `Event ${event.time ? `at ${event.time}` : "today"}${event.location ? ` at ${event.location}` : ""}`,
                  icon: "/favicon.ico",
                  tag: `calendar-reminder-${event._id}`,
                });
                localStorage.setItem(notificationKey, "sent");
                // Clean up old notification keys after 24 hours
                setTimeout(() => {
                  localStorage.removeItem(notificationKey);
                }, 86400000);
              }
            }
          }
        });
      }
    } catch (error) {
      console.error("Error checking calendar reminders:", error);
    }
  }

  return null; // This component doesn't render anything
}
