"use server";

import { z } from "zod";
import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Habit from "@/models/Habit";
import HabitLog from "@/models/HabitLog";
import Idea from "@/models/Idea";
import User from "@/models/User";
import Calendar from "@/models/Calendar";
import mongoose from "mongoose";
import { addWeeks, addMonths, addYears } from "date-fns";

const createHabitSchema = z.object({
  name: z.string().min(1, "Habit name is required"),
  category: z.enum(["family", "business", "personal", "work", "workBlock", "productive", "familyTime", "custom", "journal"]),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timeline: z.number().int().positive().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  month: z.number().int().min(0).max(11).optional(),
  priority: z.enum(["low", "medium", "high"]),
  reminderTime: z.string().optional(),
  ideaGenerating: z.boolean().optional(),
});

// TIME_LIMITS removed - duration validation is handled in profile setup
// Only range and overlap checks are needed here

// Helper function to convert time string (HH:MM) to minutes
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper function to calculate duration in minutes from start and end times
function calculateDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  // Handle case where end time is next day (e.g., 23:00 to 01:00)
  if (end < start) {
    return (24 * 60) - start + end;
  }
  return end - start;
}

// Map habit category to profile time allocation category
function mapCategoryToTimeAllocation(category: string): string | null {
  const mapping: { [key: string]: string } = {
    personal: "personalWork",
    work: "workBlock",
    workBlock: "workBlock",
    productive: "productive",
    familyTime: "familyTime",
    family: "familyTime",
    business: "workBlock",
    journal: "journaling",
  };
  return mapping[category] || null;
}

// Get category display name
function getCategoryDisplayName(category: string): string {
  const names: { [key: string]: string } = {
    personal: "Personal",
    work: "Work",
    workBlock: "Work Block",
    productive: "Productive",
    familyTime: "Family Time",
    family: "Family Time",
    business: "Business",
    journal: "Journal",
  };
  return names[category] || category;
}

// Helper function to check if two time ranges overlap
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false;
  
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  
  // Handle wrap-around (e.g., 23:00 to 01:00)
  const wraps1 = e1 < s1;
  const wraps2 = e2 < s2;
  
  if (wraps1 && wraps2) {
    return true;
  }
  
  if (wraps1) {
    return (s2 >= s1 && s2 < 24 * 60) || (e2 > 0 && e2 <= e1) || (s2 < e1);
  }
  
  if (wraps2) {
    return (s1 >= s2 && s1 < 24 * 60) || (e1 > 0 && e1 <= e2) || (s1 < e2);
  }
  
  return !(e1 <= s2 || e2 <= s1);
}

// Helper function to generate recurring dates based on frequency within timeline
function generateRecurringDates(
  startDate: Date,
  frequency: "daily" | "weekly" | "monthly" | "yearly",
  timelineDays: number,
  dayOfWeek?: number,
  dayOfMonth?: number,
  month?: number
): Date[] {
  const dates: Date[] = [];
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + timelineDays);
  
  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  
  if (frequency === "daily") {
    // Daily: add every day
    while (currentDate < endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else if (frequency === "weekly" && dayOfWeek !== undefined) {
    // Weekly: find next occurrence of the specified day of week
    while (currentDate.getDay() !== dayOfWeek && currentDate < endDate) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    while (currentDate < endDate) {
      dates.push(new Date(currentDate));
      currentDate = addWeeks(currentDate, 1);
    }
  } else if (frequency === "monthly" && dayOfMonth !== undefined) {
    // Monthly: find next occurrence of the specified day of month
    while (currentDate.getDate() !== dayOfMonth && currentDate < endDate) {
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(dayOfMonth);
      if (nextMonth < endDate) {
        currentDate = nextMonth;
      } else {
        break;
      }
    }
    while (currentDate < endDate) {
      dates.push(new Date(currentDate));
      currentDate = addMonths(currentDate, 1);
      // Handle months with fewer days (e.g., Feb 31 -> Feb 28/29)
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      currentDate.setDate(Math.min(dayOfMonth, lastDayOfMonth));
    }
  } else if (frequency === "yearly" && month !== undefined && dayOfMonth !== undefined) {
    // Yearly: find next occurrence of the specified month and day
    while ((currentDate.getMonth() !== month || currentDate.getDate() !== dayOfMonth) && currentDate < endDate) {
      const nextYear = new Date(currentDate);
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      nextYear.setMonth(month);
      const lastDayOfMonth = new Date(nextYear.getFullYear(), nextYear.getMonth() + 1, 0).getDate();
      nextYear.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      if (nextYear < endDate) {
        currentDate = nextYear;
      } else {
        break;
      }
    }
    while (currentDate < endDate) {
      dates.push(new Date(currentDate));
      currentDate = addYears(currentDate, 1);
      currentDate.setMonth(month);
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      currentDate.setDate(Math.min(dayOfMonth, lastDayOfMonth));
    }
  }
  
  return dates;
}

// Check if a time range is completely within another time range
function isTimeRangeWithin(
  innerStart: string,
  innerEnd: string,
  outerStart: string,
  outerEnd: string
): boolean {
  if (!innerStart || !innerEnd || !outerStart || !outerEnd) return false;

  const innerStartMin = timeToMinutes(innerStart);
  const innerEndMin = timeToMinutes(innerEnd);
  const outerStartMin = timeToMinutes(outerStart);
  const outerEndMin = timeToMinutes(outerEnd);

  // Handle overnight ranges for outer range
  const outerWraps = outerEndMin < outerStartMin;
  const innerWraps = innerEndMin < innerStartMin;

  if (outerWraps) {
    // Outer range wraps (e.g., 23:00 to 06:00)
    // Inner range must be either:
    // 1. Completely within the first part (outerStart to 24:00)
    // 2. Completely within the second part (00:00 to outerEnd)
    // 3. Or wrap itself but still be within
    if (innerWraps) {
      // Both wrap - inner must be within outer
      return innerStartMin >= outerStartMin && innerEndMin <= outerEndMin;
    } else {
      // Inner doesn't wrap, outer does
      // Inner must be in first part OR second part
      return (innerStartMin >= outerStartMin && innerEndMin <= 24 * 60) ||
             (innerStartMin >= 0 && innerEndMin <= outerEndMin);
    }
  } else {
    // Outer range doesn't wrap (normal case)
    if (innerWraps) {
      // Inner wraps but outer doesn't - not possible to be within
      return false;
    } else {
      // Neither wraps - simple check
      return innerStartMin >= outerStartMin && innerEndMin <= outerEndMin;
    }
  }
}

export async function createHabit(formData: FormData) {
  try {
    const user = await requireAuth();
    await connectDB();

    const rawData = {
      name: (formData.get("name") as string) || "",
      category: (formData.get("category") as string) || "",
      startTime: (formData.get("startTime") as string) || undefined,
      endTime: (formData.get("endTime") as string) || undefined,
      timeline: formData.get("timeline") ? parseInt(formData.get("timeline") as string) : undefined,
      frequency: (formData.get("frequency") as string) || "daily",
      dayOfWeek: formData.get("dayOfWeek") ? parseInt(formData.get("dayOfWeek") as string) : undefined,
      dayOfMonth: formData.get("dayOfMonth") ? parseInt(formData.get("dayOfMonth") as string) : undefined,
      month: formData.get("month") ? parseInt(formData.get("month") as string) : undefined,
      priority: (formData.get("priority") as string) || "medium",
      reminderTime: (formData.get("reminderTime") as string) || undefined,
      ideaGenerating: formData.get("ideaGenerating") === "true",
    };

    const validatedData = createHabitSchema.parse(rawData);

    // Validate time slot if provided
    // Only validates: time within allocated range and no overlaps
    // Duration min/max checks are NOT needed - already validated in profile setup
    if (validatedData.startTime && validatedData.endTime) {
      const timeAllocationKey = mapCategoryToTimeAllocation(validatedData.category);
      if (timeAllocationKey) {
        // Get user profile to access time allocation
        const dbUser = await User.findById(user.userId).select("timeCategories").lean();
        if (dbUser && dbUser.timeCategories) {
          const timeCategory = (dbUser.timeCategories as any)[timeAllocationKey];
          
          // FIRST: Check if habit time is within the allocated time range
          if (timeCategory && timeCategory.startTime && timeCategory.endTime) {
            if (!isTimeRangeWithin(
              validatedData.startTime,
              validatedData.endTime,
              timeCategory.startTime,
              timeCategory.endTime
            )) {
              return {
                error: `${getCategoryDisplayName(validatedData.category)} habit time (${validatedData.startTime} - ${validatedData.endTime}) is outside the allocated ${getCategoryDisplayName(validatedData.category)} Time range (${timeCategory.startTime} - ${timeCategory.endTime}) in your profile.`
              };
            }
          }

          // SECOND: Check for overlaps with existing habits in the same category
          const existingHabits = await Habit.find({
            userId: user.userId,
            $or: [
              { category: validatedData.category },
              // Handle related categories
              ...(validatedData.category === "work" ? [{ category: "workBlock" }] : []),
              ...(validatedData.category === "workBlock" ? [{ category: "work" }] : []),
            ],
            startTime: { $exists: true, $ne: null },
            endTime: { $exists: true, $ne: null },
          }).select("name startTime endTime").lean();

          // Check for overlaps
          const overlappingHabit = existingHabits.find((habit: any) => {
            if (!habit.startTime || !habit.endTime) return false;
            return timeRangesOverlap(
              validatedData.startTime!,
              validatedData.endTime!,
              habit.startTime,
              habit.endTime
            );
          });

          if (overlappingHabit) {
            return {
              error: `Time slot overlaps with existing habit "${overlappingHabit.name}" (${overlappingHabit.startTime} - ${overlappingHabit.endTime}). Please choose a different time slot.`
            };
          }
        }
      }
    }

    const habit = await Habit.create({
      userId: new mongoose.Types.ObjectId(user.userId),
      name: validatedData.name,
      category: validatedData.category,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      timeline: validatedData.timeline,
      frequency: validatedData.frequency,
      dayOfWeek: validatedData.dayOfWeek,
      dayOfMonth: validatedData.dayOfMonth,
      month: validatedData.month,
      priority: validatedData.priority,
      reminderTime: validatedData.reminderTime,
      ideaGenerating: validatedData.ideaGenerating,
      completionPercentage: 0, // Initialize at 0
    });

    // If timeline is provided, create day-wise schedule entries
    if (validatedData.timeline) {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      
      let datesToCreate: Date[] = [];
      
      // For daily habits, create entries for every day in timeline
      if (validatedData.frequency === "daily") {
        for (let i = 0; i < validatedData.timeline; i++) {
          const logDate = new Date(startDate);
          logDate.setDate(startDate.getDate() + i);
          datesToCreate.push(logDate);
        }
      } else if (
        validatedData.frequency !== "custom" &&
        validatedData.startTime &&
        validatedData.endTime
      ) {
        // For weekly/monthly/yearly habits, only create entries for recurring dates
        datesToCreate = generateRecurringDates(
          startDate,
          validatedData.frequency,
          validatedData.timeline,
          validatedData.dayOfWeek,
          validatedData.dayOfMonth,
          validatedData.month
        );
      }
      
      // Create HabitLog entries
      const logEntries = datesToCreate.map((date) => ({
        habitId: habit._id,
        userId: new mongoose.Types.ObjectId(user.userId),
        date: date,
        status: "skipped" as const, // Initialize as skipped, will be updated when user marks as done
      }));
      
      // Insert all log entries in bulk
      if (logEntries.length > 0) {
        await HabitLog.insertMany(logEntries);
      }
    }

    // Generate calendar events for recurring habits (weekly, monthly, yearly) within timeline
    if (
      validatedData.timeline &&
      validatedData.frequency !== "daily" &&
      validatedData.frequency !== "custom" &&
      validatedData.startTime &&
      validatedData.endTime
    ) {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      
      // Generate recurring dates based on frequency
      const recurringDates = generateRecurringDates(
        startDate,
        validatedData.frequency,
        validatedData.timeline,
        validatedData.dayOfWeek,
        validatedData.dayOfMonth,
        validatedData.month
      );
      
      // Create calendar events for each recurring date
      const calendarEvents = recurringDates.map((date) => {
        const eventDate = new Date(date);
        // Set time to habit start time
        const [hours, minutes] = validatedData.startTime!.split(":").map(Number);
        eventDate.setHours(hours, minutes, 0, 0);
        
        return {
          userId: new mongoose.Types.ObjectId(user.userId),
          title: habit.name,
          type: "habit" as const,
          description: `${habit.name} - ${validatedData.category}`,
          date: eventDate,
          time: validatedData.startTime,
          habitId: habit._id,
        };
      });
      
      // Insert all calendar events in bulk
      if (calendarEvents.length > 0) {
        await Calendar.insertMany(calendarEvents);
      }
    }

    return { success: true, habit: JSON.parse(JSON.stringify(habit)) };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return { error: `${firstError.path.join(".")}: ${firstError.message}` };
    }
    return { error: error.message || "Failed to create habit" };
  }
}

export async function getHabits() {
  try {
    const user = await requireAuth();
    await connectDB();

    const habits = await Habit.find({ userId: user.userId }).sort({ createdAt: -1 }).lean();

    // Update completion percentages in parallel (non-blocking)
    const updatePromises = habits
      .filter(habit => habit.timeline)
      .map(habit => updateHabitCompletionPercentage(habit._id.toString(), user.userId));
    
    // Don't wait for updates - return habits immediately
    // Updates will happen in background
    Promise.all(updatePromises).catch(err => {
      console.error("Error updating completion percentages:", err);
    });

    return { success: true, habits: JSON.parse(JSON.stringify(habits)) };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch habits" };
  }
}

// Core categories that must have at least one habit
const CORE_CATEGORIES = ["personal", "workBlock", "productive", "familyTime", "journal"] as const;
type CoreCategory = typeof CORE_CATEGORIES[number];

// Map habit categories to core categories
function mapToCoreCategory(category: string): CoreCategory | null {
  const mapping: { [key: string]: CoreCategory } = {
    personal: "personal",
    work: "workBlock", // work maps to workBlock
    workBlock: "workBlock",
    productive: "productive",
    family: "familyTime", // family maps to familyTime
    familyTime: "familyTime",
    business: "workBlock", // business maps to workBlock
    journal: "journal",
    custom: "personal", // custom defaults to personal
  };
  return mapping[category] || null;
}

export async function checkHabitRequirements() {
  try {
    const user = await requireAuth();
    await connectDB();

    const habits = await Habit.find({ userId: user.userId }).select("category startTime endTime").lean();

    const totalHabits = habits.length;
    const MIN_HABITS = 5;

    // Check minimum habits requirement
    const hasMinimumHabits = totalHabits >= MIN_HABITS;

    // Check core categories coverage
    const coveredCategories = new Set<CoreCategory>();
    habits.forEach((habit: any) => {
      const coreCategory = mapToCoreCategory(habit.category);
      if (coreCategory) {
        coveredCategories.add(coreCategory);
      }
    });

    const missingCategories = CORE_CATEGORIES.filter((cat) => !coveredCategories.has(cat));

    // Check if Journal habit exists
    const journalHabit = habits.find((h: any) => h.category === "journal");
    const journalExists = !!journalHabit;

    const isComplete = hasMinimumHabits && missingCategories.length === 0 && journalExists;

    return {
      success: true,
      isComplete,
      totalHabits,
      hasMinimumHabits,
      requiredHabits: MIN_HABITS,
      coveredCategories: Array.from(coveredCategories),
      missingCategories,
      journalExists: journalExists,
      journalHabit: journalHabit ? JSON.parse(JSON.stringify(journalHabit)) : null,
    };
  } catch (error: any) {
    console.error("[HABITS ACTION] Error checking habit requirements:", error);
    return { success: false, error: error.message || "Failed to check habit requirements" };
  }
}

export async function deleteHabit(habitId: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const habit = await Habit.findOneAndDelete({
      _id: habitId,
      userId: user.userId,
    });

    if (!habit) {
      return { error: "Habit not found" };
    }

    // Delete related logs, ideas, and calendar events
    await HabitLog.deleteMany({ habitId: habit._id, userId: user.userId });
    await Idea.updateMany(
      { habitId: habit._id, userId: user.userId },
      { $unset: { habitId: 1 } }
    );
    await Calendar.deleteMany({ habitId: habit._id, userId: user.userId });

    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete habit" };
  }
}

export async function logHabit(habitId: string, status: "done" | "skipped", date?: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const logDate = date ? new Date(date) : new Date();
    logDate.setHours(0, 0, 0, 0);

    // Check if habit belongs to user
    const habit = await Habit.findOne({
      _id: habitId,
      userId: user.userId,
    });

    if (!habit) {
      return { error: "Habit not found" };
    }

    // Upsert log
    const log = await HabitLog.findOneAndUpdate(
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

    // Update completion percentage for the habit
    await updateHabitCompletionPercentage(habitId, user.userId);

    return { success: true, log: JSON.parse(JSON.stringify(log)) };
  } catch (error: any) {
    return { error: error.message || "Failed to log habit" };
  }
}

export async function getHabitLogs(habitId?: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const query: any = { userId: user.userId };
    if (habitId) {
      query.habitId = habitId;
    }

    const logs = await HabitLog.find(query).sort({ date: -1 });

    return { success: true, logs: JSON.parse(JSON.stringify(logs)) };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch logs" };
  }
}

export async function getTodayHabits() {
  try {
    const user = await requireAuth();
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const habits = await Habit.find({ userId: user.userId }).lean();
    const logs = await HabitLog.find({
      userId: user.userId,
      date: today,
    }).lean();

    const logMap = new Map(logs.map((log: any) => [log.habitId.toString(), log.status]));

    // Group habits by category
    const habitsByCategory: Record<string, any[]> = {};
    habits.forEach((habit: any) => {
      const category = habit.category || "custom";
      if (!habitsByCategory[category]) {
        habitsByCategory[category] = [];
      }
      habitsByCategory[category].push({
        ...habit,
        todayStatus: logMap.get(habit._id.toString()) || null,
      });
    });

    const habitsWithStatus = habits.map((habit: any) => ({
      ...habit,
      todayStatus: logMap.get(habit._id.toString()) || null,
    }));

    return { 
      success: true, 
      habits: JSON.parse(JSON.stringify(habitsWithStatus)),
      habitsByCategory: JSON.parse(JSON.stringify(habitsByCategory))
    };
  } catch (error: any) {
    console.error("Error in getTodayHabits:", error);
    return { success: false, habits: [], error: error.message || "Failed to fetch today's habits" };
  }
}

// Helper function to calculate and update completion percentage
async function updateHabitCompletionPercentage(habitId: string, userId: string) {
  try {
    const habit = await Habit.findById(habitId);
    if (!habit || !habit.timeline) return;

    const logs = await HabitLog.find({
      habitId: new mongoose.Types.ObjectId(habitId),
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    const totalDays = habit.timeline;
    const completedDays = logs.filter((log: any) => log.status === "done").length;
    const completionPercentage = Math.round((completedDays / totalDays) * 100);

    await Habit.findByIdAndUpdate(habitId, {
      completionPercentage: Math.min(100, Math.max(0, completionPercentage)),
    });
  } catch (error) {
    console.error("Error updating completion percentage:", error);
  }
}

export async function getHabitStreak(habitId: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const logs = await HabitLog.find({
      habitId,
      userId: user.userId,
      status: "done",
    })
      .sort({ date: -1 })
      .limit(365);

    if (logs.length === 0) return { success: true, streak: 0 };

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today is done
    const todayLog = logs.find(
      (log) => log.date.toDateString() === today.toDateString()
    );

    if (!todayLog) {
      // Check yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayLog = logs.find(
        (log) => log.date.toDateString() === yesterday.toDateString()
      );
      if (!yesterdayLog) return { success: true, streak: 0 };
    }

    // Count consecutive days
    let currentDate = new Date(today);
    for (const log of logs) {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);

      if (logDate.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (logDate.getTime() < currentDate.getTime()) {
        break;
      }
    }

    return { success: true, streak };
  } catch (error: any) {
    return { error: error.message || "Failed to calculate streak" };
  }
}

// Helper function to check if a habit should occur on a specific date
function shouldHabitOccurOnDate(habit: any, date: Date): boolean {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  if (habit.frequency === "daily") {
    return true;
  } else if (habit.frequency === "weekly" && habit.dayOfWeek !== undefined) {
    return checkDate.getDay() === habit.dayOfWeek;
  } else if (habit.frequency === "monthly" && habit.dayOfMonth !== undefined) {
    const lastDayOfMonth = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(habit.dayOfMonth, lastDayOfMonth);
    return checkDate.getDate() === targetDay;
  } else if (habit.frequency === "yearly" && habit.month !== undefined && habit.dayOfMonth !== undefined) {
    const lastDayOfMonth = new Date(checkDate.getFullYear(), habit.month + 1, 0).getDate();
    const targetDay = Math.min(habit.dayOfMonth, lastDayOfMonth);
    return checkDate.getMonth() === habit.month && checkDate.getDate() === targetDay;
  }
  
  return false;
}

// Get habits for a specific date
export async function getHabitsForDate(date: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Get all habits for the user
    const habits = await Habit.find({ userId: user.userId }).lean();
    
    // Filter habits that should occur on this date
    const habitsForDate = habits.filter((habit: any) => {
      // Check if habit should occur on this date based on frequency
      if (!shouldHabitOccurOnDate(habit, checkDate)) {
        return false;
      }
      
      // Check if date is within timeline (if timeline is set)
      if (habit.timeline) {
        const habitStartDate = new Date(habit.createdAt);
        habitStartDate.setHours(0, 0, 0, 0);
        const habitEndDate = new Date(habitStartDate);
        habitEndDate.setDate(habitEndDate.getDate() + habit.timeline);
        
        if (checkDate < habitStartDate || checkDate >= habitEndDate) {
          return false;
        }
      }
      
      return true;
    });
    
    // Sort by start time
    habitsForDate.sort((a: any, b: any) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
    
    return { success: true, habits: JSON.parse(JSON.stringify(habitsForDate)) };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch habits for date" };
  }
}

export async function getUserStreak() {
  try {
    const user = await requireAuth();
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all completed habit logs for the user
    const logs = await HabitLog.find({
      userId: user.userId,
      status: "done",
    })
      .sort({ date: -1 })
      .limit(365)
      .lean();

    if (logs.length === 0) return { success: true, streak: 0 };

    // Get unique dates where at least one habit was completed
    const completedDates = new Set<string>();
    logs.forEach((log: any) => {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);
      completedDates.add(logDate.toISOString());
    });

    // Convert to sorted array of dates
    const sortedDates = Array.from(completedDates)
      .map((dateStr) => new Date(dateStr))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    let currentDate = new Date(today);

    // Check if today has at least one completed habit
    const todayStr = currentDate.toISOString();
    const hasToday = completedDates.has(todayStr);

    if (!hasToday) {
      // Check yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();
      if (!completedDates.has(yesterdayStr)) {
        return { success: true, streak: 0 };
      }
      // Start counting from yesterday
      currentDate = new Date(yesterday);
    }

    // Count consecutive days
    for (const date of sortedDates) {
      const dateStr = date.toISOString();
      const currentStr = currentDate.toISOString();

      if (dateStr === currentStr) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (date.getTime() < currentDate.getTime()) {
        break;
      }
    }

    return { success: true, streak };
  } catch (error: any) {
    console.error("Error calculating user streak:", error);
    return { success: false, error: error.message || "Failed to calculate streak", streak: 0 };
  }
}
