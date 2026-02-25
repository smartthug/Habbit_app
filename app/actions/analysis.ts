"use server";

import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Habit from "@/models/Habit";
import HabitLog from "@/models/HabitLog";
import Calendar from "@/models/Calendar";
import Idea from "@/models/Idea";
import DailyLog from "@/models/DailyLog";
import mongoose from "mongoose";
import { startOfDay, endOfDay, addDays, isSameDay, format } from "date-fns";

export async function getAnalysisData() {
  try {
    const user = await requireAuth();
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = addDays(today, 1);
    const tomorrowEnd = endOfDay(tomorrow);

    // Get all habits
    const habits = await Habit.find({ userId: user.userId }).lean();
    
    // Get today's habit logs
    const todayLogs = await HabitLog.find({
      userId: user.userId,
      date: today,
    }).lean();

    const logMap = new Map(todayLogs.map((log: any) => [log.habitId.toString(), log.status]));

    // Categorize habits
    const todayHabits = habits
      .filter((habit: any) => {
        const status = logMap.get(habit._id.toString());
        return status === null || status === "skipped";
      })
      .map((habit: any) => ({
        ...habit,
        status: logMap.get(habit._id.toString()) || "pending",
        type: "habit",
      }));

    const completedHabits = habits
      .filter((habit: any) => logMap.get(habit._id.toString()) === "done")
      .map((habit: any) => ({
        ...habit,
        status: "done",
        type: "habit",
      }));

    // Get calendar events
    const todayEvents = await Calendar.find({
      userId: user.userId,
      date: {
        $gte: startOfDay(today),
        $lte: endOfDay(today),
      },
    }).lean();

    const tomorrowEvents = await Calendar.find({
      userId: user.userId,
      date: {
        $gte: startOfDay(tomorrow),
        $lte: tomorrowEnd,
      },
    }).lean();

    const futureEvents = await Calendar.find({
      userId: user.userId,
      date: {
        $gt: tomorrowEnd,
      },
      type: { $in: ["todo", "meeting", "birthday"] }, // Only show Todo, Meeting, and Birthday
    })
      .sort({ date: 1 })
      .limit(20)
      .lean();

    // Get past incomplete calendar events (pending work from yesterday or past months)
    const yesterday = addDays(today, -1);
    const pastIncompleteEvents = await Calendar.find({
      userId: user.userId,
      date: {
        $lt: startOfDay(today), // Before today
      },
      type: { $in: ["todo", "meeting", "birthday"] }, // Only Todo, Meeting, and Birthday
    })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    // Combine tasks
    const todayTasks = [
      ...todayHabits.map((h: any) => ({ ...h, type: "habit" })),
      ...todayEvents.map((e: any) => ({ ...e, type: e.type || "todo" })),
    ];

    const tomorrowTasks = [
      ...tomorrowEvents.map((e: any) => ({ ...e, type: e.type || "todo" })),
    ];

    const completedTasks = [
      ...completedHabits.map((h: any) => ({ ...h, type: "habit" })),
    ];

    // Pending tasks include all incomplete habits from today (not done)
    // This includes habits with status "pending", "skipped", or null (not logged)
    // Also include past incomplete calendar events (pending work from yesterday or past months)
    const pendingTasks = [
      ...todayHabits.map((h: any) => ({ ...h, type: "habit" })),
      ...pastIncompleteEvents.map((e: any) => ({
        ...e,
        type: e.type || "todo",
        name: e.title,
        title: e.title,
      })),
    ];

    const futureTasks = [
      ...futureEvents.map((e: any) => ({ ...e, type: e.type || "todo" })),
    ];

    // Calculate habit consistency
    const habitConsistency = await Promise.all(
      habits.map(async (habit: any) => {
        const logs = await HabitLog.find({
          habitId: habit._id,
          userId: user.userId,
          status: "done",
        })
          .sort({ date: -1 })
          .limit(30)
          .lean();

        const totalDays = 30;
        const completedDays = logs.length;
        const consistency = (completedDays / totalDays) * 100;

        // Calculate streak
        let streak = 0;
        if (logs.length > 0) {
          const todayLog = logs.find((log: any) =>
            isSameDay(new Date(log.date), today)
          );
          if (todayLog) {
            let currentDate = new Date(today);
            for (const log of logs) {
              const logDate = new Date(log.date);
              if (isSameDay(logDate, currentDate)) {
                streak++;
                currentDate = addDays(currentDate, -1);
              } else if (logDate < currentDate) {
                break;
              }
            }
          }
        }

        return {
          habitId: habit._id.toString(),
          habitName: habit.name,
          consistency: Math.round(consistency),
          streak,
          completedDays,
          totalDays,
        };
      })
    );

    // Get best ideas (high priority, recent, or frequently referenced)
    const allIdeas = await Idea.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Score ideas based on priority, recency, and tags
    const scoredIdeas = allIdeas.map((idea: any) => {
      let score = 0;
      
      // Priority boost
      if (idea.priority === "important" || idea.priority === "high") {
        score += 10;
      }
      
      // Recency boost (ideas from last 7 days get bonus)
      const daysSinceCreation = Math.floor(
        (today.getTime() - new Date(idea.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceCreation <= 7) {
        score += 5;
      } else if (daysSinceCreation <= 30) {
        score += 2;
      }
      
      // Tags boost (ideas with tags are more actionable)
      if (idea.tags && idea.tags.length > 0) {
        score += idea.tags.length;
      }
      
      // Topic association boost
      if (idea.topicId) {
        score += 3;
      }
      
      // Habit association boost
      if (idea.habitId) {
        score += 3;
      }

      return {
        ...idea,
        score,
      };
    });

    // Sort by score and get top 10
    const bestIdeas = scoredIdeas
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ score, ...idea }) => idea); // Remove score from output

    // Calculate task repetition patterns
    const repetitionPatterns = await Promise.all(
      habits.map(async (habit: any) => {
        const logs = await HabitLog.find({
          habitId: habit._id,
          userId: user.userId,
          status: "done",
        })
          .sort({ date: -1 })
          .limit(90)
          .lean();

        // Count by day of week
        const dayOfWeekCount: Record<number, number> = {};
        logs.forEach((log: any) => {
          const day = new Date(log.date).getDay();
          dayOfWeekCount[day] = (dayOfWeekCount[day] || 0) + 1;
        });

        // Find most common day
        const mostCommonDay = Object.entries(dayOfWeekCount).sort(
          ([, a], [, b]) => b - a
        )[0]?.[0];

        return {
          habitId: habit._id.toString(),
          habitName: habit.name,
          totalCompletions: logs.length,
          mostCommonDay: mostCommonDay
            ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseInt(mostCommonDay)]
            : null,
          dayOfWeekCount,
        };
      })
    );

    return {
      success: true,
      data: {
        todayTasks: JSON.parse(JSON.stringify(todayTasks)),
        tomorrowTasks: JSON.parse(JSON.stringify(tomorrowTasks)),
        pendingTasks: JSON.parse(JSON.stringify(pendingTasks)),
        completedTasks: JSON.parse(JSON.stringify(completedTasks)),
        futureTasks: JSON.parse(JSON.stringify(futureTasks)),
        habitConsistency: JSON.parse(JSON.stringify(habitConsistency)),
        bestIdeas: JSON.parse(JSON.stringify(bestIdeas)),
        repetitionPatterns: JSON.parse(JSON.stringify(repetitionPatterns)),
      },
    };
  } catch (error: any) {
    console.error("Error in getAnalysisData:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch analysis data",
    };
  }
}

export async function addIncompleteTasksToPendingHabits() {
  try {
    const user = await requireAuth();
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all habits
    const habits = await Habit.find({ userId: user.userId }).lean();
    
    // Get today's habit logs
    const todayLogs = await HabitLog.find({
      userId: user.userId,
      date: today,
    }).lean();

    const logMap = new Map(todayLogs.map((log: any) => [log.habitId.toString(), log.status]));

    // Get incomplete habits (not done) - these are already pending, so we don't need to create new ones
    // But we'll mark them as pending if they're skipped

    // Get today's calendar events (these are incomplete tasks that should become habits)
    const todayEvents = await Calendar.find({
      userId: user.userId,
      date: {
        $gte: startOfDay(today),
        $lte: endOfDay(today),
      },
    }).lean();

    // Create habits from incomplete calendar events
    const createdHabits = [];
    for (const event of todayEvents) {
      // Check if a habit with this name already exists
      const existingHabit = await Habit.findOne({
        userId: user.userId,
        name: event.title,
      });

      if (!existingHabit) {
        // Parse time if available (format: "HH:MM" or "HH:MM AM/PM")
        let startTime: string | undefined;
        let endTime: string | undefined;
        
        if (event.time) {
          // Try to parse time - assume it's in HH:MM format or convert from 12-hour
          const timeStr = event.time.trim();
          if (timeStr.includes(":")) {
            const [hours, minutes] = timeStr.split(":");
            const hourNum = parseInt(hours);
            if (!isNaN(hourNum) && hourNum >= 0 && hourNum < 24) {
              startTime = `${hours.padStart(2, "0")}:${minutes.substring(0, 2).padStart(2, "0")}`;
            }
          }
        }

        // Create a new habit from the calendar event
        const newHabit = await Habit.create({
          userId: new mongoose.Types.ObjectId(user.userId),
          name: event.title,
          category: event.type === "meeting" ? "workBlock" : event.type === "birthday" ? "familyTime" : "custom",
          frequency: "daily",
          priority: "medium",
          startTime: startTime,
          endTime: endTime,
        });
        createdHabits.push(newHabit);
      }
    }

    // Also mark incomplete habits (skipped) as pending by ensuring they have a log entry
    const incompleteHabits = habits.filter((habit: any) => {
      const status = logMap.get(habit._id.toString());
      return status === "skipped" || status === null || status === undefined;
    });

    for (const habit of incompleteHabits) {
      const existingLog = todayLogs.find((log: any) => log.habitId.toString() === habit._id.toString());
      if (!existingLog || existingLog.status === "skipped") {
        // Ensure there's a log entry marked as skipped (pending)
        await HabitLog.findOneAndUpdate(
          {
            habitId: habit._id,
            userId: user.userId,
            date: today,
          },
          {
            habitId: habit._id,
            userId: user.userId,
            date: today,
            status: "skipped",
          },
          { upsert: true, new: true }
        );
      }
    }

    return {
      success: true,
      message: `Added ${createdHabits.length} incomplete task(s) as pending habits`,
      createdHabits: JSON.parse(JSON.stringify(createdHabits)),
    };
  } catch (error: any) {
    console.error("Error adding incomplete tasks to pending habits:", error);
    return {
      success: false,
      error: error.message || "Failed to add incomplete tasks to pending habits",
    };
  }
}