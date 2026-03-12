"use server";

import { z } from "zod";
import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Calendar from "@/models/Calendar";
import mongoose from "mongoose";

const createCalendarSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  type: z.enum(["meeting", "todo", "birthday", "habit"]),
  description: z.string().optional(),
  date: z.string(),
  time: z.string().optional(),
  deadline: z.string().optional(),
  habitId: z.string().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderMinutesBefore: z.number().optional(),
  location: z.string().optional(),
  recurringEnabled: z.boolean().optional(),
  recurringFrequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  recurringEndDate: z.string().optional(),
});

export async function createCalendarEvent(formData: FormData) {
  try {
    const user = await requireAuth();
    await connectDB();

    const rawData = {
      title: (formData.get("title") as string) || "",
      type: (formData.get("type") as string) || "event",
      description: (formData.get("description") as string) || undefined,
      date: (formData.get("date") as string) || "",
      time: (formData.get("time") as string) || undefined,
      reminderEnabled: formData.get("reminderEnabled") === "true",
      reminderMinutesBefore: formData.get("reminderMinutesBefore")
        ? parseInt(formData.get("reminderMinutesBefore") as string)
        : undefined,
      location: (formData.get("location") as string) || undefined,
      recurringEnabled: formData.get("recurringEnabled") === "true",
      recurringFrequency: (formData.get("recurringFrequency") as string) || undefined,
      recurringEndDate: (formData.get("recurringEndDate") as string) || undefined,
    };

    const validatedData = createCalendarSchema.parse(rawData);

    // Parse date and time
    const eventDate = new Date(validatedData.date);
    if (validatedData.time) {
      const [hours, minutes] = validatedData.time.split(":").map(Number);
      eventDate.setHours(hours, minutes, 0, 0);
    } else {
      eventDate.setHours(0, 0, 0, 0);
    }

    // Parse deadline if provided
    let deadline: Date | undefined;
    if (validatedData.deadline) {
      deadline = new Date(validatedData.deadline);
      deadline.setHours(23, 59, 59, 999); // Set to end of day
    }

    const calendarEvent = await Calendar.create({
      userId: new mongoose.Types.ObjectId(user.userId),
      title: validatedData.title,
      type: validatedData.type,
      description: validatedData.description,
      date: eventDate,
      time: validatedData.time,
      deadline: deadline,
      habitId: validatedData.habitId ? new mongoose.Types.ObjectId(validatedData.habitId) : undefined,
      reminder: {
        enabled: validatedData.reminderEnabled || false,
        minutesBefore: validatedData.reminderMinutesBefore || 15,
      },
      location: validatedData.location,
      recurring: {
        enabled: validatedData.recurringEnabled || false,
        frequency: validatedData.recurringFrequency || "yearly",
        endDate: validatedData.recurringEndDate ? new Date(validatedData.recurringEndDate) : undefined,
      },
    });

    return { success: true, event: JSON.parse(JSON.stringify(calendarEvent)) };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return { error: `${firstError.path.join(".")}: ${firstError.message}` };
    }
    return { error: error.message || "Failed to create calendar event" };
  }
}

export async function getCalendarEvents(startDate?: string, endDate?: string, type?: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const query: any = { userId: user.userId };

    if (startDate || endDate) {
      const dateRange: Record<string, Date> = {};
      if (startDate) dateRange.$gte = new Date(startDate);
      if (endDate) dateRange.$lte = new Date(endDate);
      // Include events in range OR yearly recurring (so they appear every year on same month/day)
      query.$or = [
        Object.keys(dateRange).length ? { date: dateRange } : {},
        { "recurring.enabled": true, "recurring.frequency": "yearly" },
      ].filter((clause) => Object.keys(clause).length > 0);
    }

    if (type) {
      query.type = type;
    }

    const events = await Calendar.find(query)
      .select("title type description date time deadline habitId reminder location recurring")
      .sort({ date: 1, time: 1 })
      .lean();

    return { success: true, events: JSON.parse(JSON.stringify(events)) };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch calendar events" };
  }
}

export async function getCalendarEventById(eventId: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const event = await Calendar.findOne({
      _id: eventId,
      userId: user.userId,
    });

    if (!event) {
      return { error: "Event not found" };
    }

    return { success: true, event: JSON.parse(JSON.stringify(event)) };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch calendar event" };
  }
}

export async function updateCalendarEvent(eventId: string, formData: FormData) {
  try {
    const user = await requireAuth();
    await connectDB();

    const rawData = {
      title: (formData.get("title") as string) || "",
      type: (formData.get("type") as string) || "todo",
      description: (formData.get("description") as string) || undefined,
      date: (formData.get("date") as string) || "",
      time: (formData.get("time") as string) || undefined,
      deadline: (formData.get("deadline") as string) || undefined,
      reminderEnabled: formData.get("reminderEnabled") === "true",
      reminderMinutesBefore: formData.get("reminderMinutesBefore")
        ? parseInt(formData.get("reminderMinutesBefore") as string)
        : undefined,
      location: (formData.get("location") as string) || undefined,
      recurringEnabled: formData.get("recurringEnabled") === "true",
      recurringFrequency: (formData.get("recurringFrequency") as string) || undefined,
      recurringEndDate: (formData.get("recurringEndDate") as string) || undefined,
    };

    const validatedData = createCalendarSchema.parse(rawData);

    // Check if event belongs to user
    const existingEvent = await Calendar.findOne({
      _id: eventId,
      userId: user.userId,
    });

    if (!existingEvent) {
      return { error: "Event not found" };
    }

    // Parse date and time
    const eventDate = new Date(validatedData.date);
    if (validatedData.time) {
      const [hours, minutes] = validatedData.time.split(":").map(Number);
      eventDate.setHours(hours, minutes, 0, 0);
    } else {
      eventDate.setHours(0, 0, 0, 0);
    }

    // Parse deadline if provided
    let deadline: Date | undefined;
    if (validatedData.deadline) {
      deadline = new Date(validatedData.deadline);
      deadline.setHours(23, 59, 59, 999); // Set to end of day
    }

    const updatedEvent = await Calendar.findByIdAndUpdate(
      eventId,
      {
        title: validatedData.title,
        type: validatedData.type,
        description: validatedData.description,
        date: eventDate,
        time: validatedData.time,
        deadline: deadline,
        reminder: {
          enabled: validatedData.reminderEnabled || false,
          minutesBefore: validatedData.reminderMinutesBefore || 15,
        },
        location: validatedData.location,
        recurring: {
          enabled: validatedData.recurringEnabled || false,
          frequency: validatedData.recurringFrequency || "yearly",
          endDate: validatedData.recurringEndDate ? new Date(validatedData.recurringEndDate) : undefined,
        },
      },
      { new: true }
    );

    return { success: true, event: JSON.parse(JSON.stringify(updatedEvent)) };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return { error: `${firstError.path.join(".")}: ${firstError.message}` };
    }
    return { error: error.message || "Failed to update calendar event" };
  }
}

export async function deleteCalendarEvent(eventId: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const event = await Calendar.findOneAndDelete({
      _id: eventId,
      userId: user.userId,
    });

    if (!event) {
      return { error: "Event not found" };
    }

    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete calendar event" };
  }
}

export async function getUpcomingEvents(limit: number = 5) {
  try {
    const user = await requireAuth();
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await Calendar.find({
      userId: user.userId,
      date: { $gte: today },
    })
      .select("title type description date time deadline habitId reminder location recurring")
      .sort({ date: 1, time: 1 })
      .limit(limit)
      .lean();

    return { success: true, events: JSON.parse(JSON.stringify(events)) };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch upcoming events" };
  }
}
