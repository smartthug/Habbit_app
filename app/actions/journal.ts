"use server";

import { z } from "zod";
import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Journal from "@/models/Journal";
import mongoose from "mongoose";

const createJournalSchema = z.object({
  habitId: z.string().optional(),
  category: z.enum(["personal", "workBlock", "productive", "familyTime"]),
  whatWorkedAnswer: z.enum(["yes", "no"]).optional(),
  whatWorkedText: z.string().min(1, "What worked text is required"),
  whatWastedTimeAnswer: z.enum(["yes", "no"]).optional(),
  whatWastedTimeText: z.string().min(1, "What wasted time text is required"),
  whereMoneyGeneratedAnswer: z.enum(["yes", "no"]),
  whereMoneyGeneratedText: z.string().optional(),
  whereLostEnergy: z.string().min(1, "Where lost energy is required"),
  howYouFeel: z.enum(["sad", "neutral", "good"]).optional(),
});

export async function createJournal(formData: FormData) {
  try {
    const user = await requireAuth();
    await connectDB();

    const rawData = {
      habitId: (formData.get("habitId") as string) || undefined,
      category: (formData.get("category") as string) || "",
      whatWorkedAnswer: (formData.get("whatWorkedAnswer") as "yes" | "no") || undefined,
      whatWorkedText: formData.get("whatWorkedText") as string,
      whatWastedTimeAnswer: (formData.get("whatWastedTimeAnswer") as "yes" | "no") || undefined,
      whatWastedTimeText: formData.get("whatWastedTimeText") as string,
      whereMoneyGeneratedAnswer: formData.get("whereMoneyGeneratedAnswer") as "yes" | "no",
      whereMoneyGeneratedText: formData.get("whereMoneyGeneratedText") as string || undefined,
      whereLostEnergy: formData.get("whereLostEnergy") as string,
      howYouFeel: (formData.get("howYouFeel") as "sad" | "neutral" | "good") || undefined,
    };

    const validatedData = createJournalSchema.parse(rawData);
    
    // Validate: if whereMoneyGeneratedAnswer is "yes", text is required
    if (validatedData.whereMoneyGeneratedAnswer === "yes" && !validatedData.whereMoneyGeneratedText?.trim()) {
      return { success: false, error: "Please provide details about where money was generated" };
    }

    const journal = await Journal.create({
      userId: new mongoose.Types.ObjectId(user.userId),
      habitId: validatedData.habitId ? new mongoose.Types.ObjectId(validatedData.habitId) : undefined,
      category: validatedData.category,
      whatWorked: {
        answer: validatedData.whatWorkedAnswer || "no",
        text: validatedData.whatWorkedText,
      },
      whatWastedTime: {
        answer: validatedData.whatWastedTimeAnswer || "no",
        text: validatedData.whatWastedTimeText,
      },
      whereMoneyGenerated: {
        answer: validatedData.whereMoneyGeneratedAnswer,
        text: validatedData.whereMoneyGeneratedText || undefined,
      },
      whereLostEnergy: validatedData.whereLostEnergy,
      howYouFeel: validatedData.howYouFeel,
    });

    return { success: true, journal: JSON.parse(JSON.stringify(journal)) };
  } catch (error: any) {
    console.error("[JOURNAL ACTION] Error creating journal:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: error.message || "Failed to create journal entry" };
  }
}

export async function getJournals(habitId?: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    const query: any = { userId: user.userId };
    if (habitId) {
      query.habitId = new mongoose.Types.ObjectId(habitId);
    }

    const journals = await Journal.find(query)
      .populate("habitId", "name")
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, journals: JSON.parse(JSON.stringify(journals)) };
  } catch (error: any) {
    console.error("[JOURNAL ACTION] Error fetching journals:", error);
    return { success: false, journals: [], error: error.message || "Failed to fetch journals" };
  }
}

export async function getTodayJournalCount() {
  try {
    const user = await requireAuth();
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const count = await Journal.countDocuments({
      userId: user.userId,
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    return { success: true, count };
  } catch (error: any) {
    console.error("[JOURNAL ACTION] Error counting today's journals:", error);
    return { success: false, count: 0, error: error.message || "Failed to count journals" };
  }
}

// Map habit categories to journal categories
function mapHabitCategoryToJournalCategory(habitCategory: string): string | null {
  const mapping: { [key: string]: string } = {
    personal: "personal",
    family: "familyTime",
    business: "workBlock",
    custom: "personal", // Default custom habits to personal
  };
  return mapping[habitCategory] || null;
}

export async function getRequiredJournalCategories() {
  try {
    const user = await requireAuth();
    await connectDB();

    // Import Habit model
    const Habit = (await import("@/models/Habit")).default;

    // Get all user habits
    const habits = await Habit.find({ userId: user.userId }).select("category").lean();

    // Check if Journal habit exists
    const journalHabit = habits.find((h: any) => h.category === "journal");

    // If no Journal habit, return empty array (no restrictions until Journal habit is created)
    if (!journalHabit) {
      return { success: true, requiredCategories: [], hasHabits: false, journalHabitConfigured: false };
    }

    // If only Journal habit exists (no other habits), return empty array
    if (habits.length === 1 && journalHabit) {
      return { success: true, requiredCategories: [], hasHabits: false, journalHabitConfigured: true };
    }

    // Get unique journal categories required based on habit categories (excluding journal habit itself)
    const requiredCategoriesSet = new Set<string>();
    habits.forEach((habit: any) => {
      // Skip the journal habit itself when determining required categories
      if (habit.category === "journal") return;
      const journalCategory = mapHabitCategoryToJournalCategory(habit.category);
      if (journalCategory) {
        requiredCategoriesSet.add(journalCategory);
      }
    });

    const requiredCategories = Array.from(requiredCategoriesSet);

    return { success: true, requiredCategories, hasHabits: true, journalHabitConfigured: true };
  } catch (error: any) {
    console.error("[JOURNAL ACTION] Error getting required categories:", error);
    return { success: false, requiredCategories: [], hasHabits: false, journalHabitConfigured: false, error: error.message };
  }
}

export async function getCompletedJournalCategories() {
  try {
    const user = await requireAuth();
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const journals = await Journal.find({
      userId: user.userId,
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .select("category")
      .lean();

    const completedCategories = journals.map((journal: any) => journal.category);

    return { success: true, completedCategories };
  } catch (error: any) {
    console.error("[JOURNAL ACTION] Error getting completed categories:", error);
    return { success: false, completedCategories: [], error: error.message };
  }
}


export async function checkJournalRequirement() {
  try {
    const user = await requireAuth();
    await connectDB();

    // Import Habit model to check if any habits exist
    const Habit = (await import("@/models/Habit")).default;

    // Step 1: Check if any habits exist
    const habitsCount = await Habit.countDocuments({ userId: user.userId });
    if (habitsCount === 0) {
      return {
        success: true,
        isRequired: false,
        redirectToHabits: true,
        reason: "No habits created. Please create at least one habit.",
      };
    }

    // Step 2: Check if Journal habit exists
    const journalHabit = await Habit.findOne({
      userId: user.userId,
      category: "journal",
    })
      .select("_id")
      .lean();

    if (!journalHabit) {
      return {
        success: true,
        isRequired: false,
        redirectToHabits: true,
        reason: "Journal habit is required. Please create a Journal habit.",
      };
    }

    // Step 3: Check current day's journal completion
    const requiredResult = await getRequiredJournalCategories();
    if (!requiredResult.success) {
      return { success: false, isRequired: false, error: requiredResult.error };
    }

    if (!requiredResult.journalHabitConfigured || requiredResult.requiredCategories.length === 0) {
      return { success: true, isRequired: false, requiredCategories: [], completedCategories: [] };
    }

    // Get completed categories for today
    const completedResult = await getCompletedJournalCategories();
    if (!completedResult.success) {
      return { success: false, isRequired: true, error: completedResult.error };
    }

    const requiredCategories = requiredResult.requiredCategories;
    const completedCategories = completedResult.completedCategories;

    // Check if all required categories are completed
    const missingCategories = requiredCategories.filter(
      (cat) => !completedCategories.includes(cat)
    );

    return {
      success: true,
      isRequired: true,
      requiredCategories,
      completedCategories,
      missingCategories,
      isComplete: missingCategories.length === 0,
    };
  } catch (error: any) {
    console.error("[JOURNAL ACTION] Error checking journal requirement:", error);
    return { success: false, isRequired: false, error: error.message };
  }
}

