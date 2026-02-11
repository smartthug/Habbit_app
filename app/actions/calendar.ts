"use server";

import { z } from "zod";
import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Calendar from "@/models/Calendar";
import mongoose from "mongoose";

const createCalendarSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  type: z.enum(["meeting", "event", "birthday"]),
  description: z.string().optional(),
  date: z.string(),
  time: z.string().optional(),
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

    const calendarEvent = await Calendar.create({
      userId: new mongoose.Types.ObjectId(user.userId),
      title: validatedData.title,
      type: validatedData.type,
      description: validatedData.description,
      date: eventDate,
      time: validatedData.time,
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
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    if (type) {
      query.type = type;
    }

    const events = await Calendar.find(query).sort({ date: 1, time: 1 });

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

    const updatedEvent = await Calendar.findByIdAndUpdate(
      eventId,
      {
        title: validatedData.title,
        type: validatedData.type,
        description: validatedData.description,
        date: eventDate,
        time: validatedData.time,
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
      .sort({ date: 1, time: 1 })
      .limit(limit);

    return { success: true, events: JSON.parse(JSON.stringify(events)) };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch upcoming events" };
  }
}
