"use server";

import { z } from "zod";
import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import User from "@/models/User";
import Habit from "@/models/Habit";
import CalendarEvent from "@/models/Calendar";
import mongoose from "mongoose";

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

// Helper function to check if two time ranges overlap (supports wrap-around)
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

  const wraps1 = e1 < s1;
  const wraps2 = e2 < s2;

  if (wraps1 && wraps2) {
    // Both wrap around - they always overlap
    return true;
  }

  if (wraps1) {
    // Range1 wraps: check if range2 overlaps with either [s1, 24*60) or [0, e1]
    return (s2 >= s1 && s2 < 24 * 60) || (e2 > 0 && e2 <= e1) || (s2 < e1);
  }

  if (wraps2) {
    // Range2 wraps: check if range1 overlaps with either [s2, 24*60) or [0, e2]
    return (s1 >= s2 && s1 < 24 * 60) || (e1 > 0 && e1 <= e2) || (s1 < e2);
  }

  // Normal case: both ranges are within the same day
  // Ranges overlap if one starts before the other ends
  return !(e1 <= s2 || e2 <= s1);
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
    if (innerWraps) {
      // Both wrap - inner must be within outer
      return innerStartMin >= outerStartMin && innerEndMin <= outerEndMin;
    } else {
      // Inner doesn't wrap, outer does
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

// Map habit category to profile time allocation category
function mapHabitCategoryToTimeAllocation(category: string): string | null {
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

// Validate existing habits against new time ranges (supports multiple ranges per category)
async function validateExistingHabits(
  userId: string,
  newTimeCategories: any
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
  
  try {
    const habits = await Habit.find({
      userId: new mongoose.Types.ObjectId(userId),
      startTime: { $exists: true, $ne: null },
      endTime: { $exists: true, $ne: null },
    }).select("name category startTime endTime").lean();

    for (const habit of habits) {
      const timeAllocationKey = mapHabitCategoryToTimeAllocation(habit.category);
      if (!timeAllocationKey || !newTimeCategories[timeAllocationKey]) continue;

      const timeCategory = newTimeCategories[timeAllocationKey];
      const ranges = timeCategory.ranges || [];
      if (!ranges.length) continue;

      // A habit is considered valid if it fits completely within at least one range
      const fitsInSomeRange = ranges.some((range: any) =>
        isTimeRangeWithin(
          habit.startTime!,
          habit.endTime!,
          range.startTime,
          range.endTime
        )
      );

      if (!fitsInSomeRange) {
        const categoryNames: { [key: string]: string } = {
          personalWork: "Personal",
          workBlock: "Work Block",
          productive: "Productive",
          familyTime: "Family Time",
          journaling: "Journal",
        };
        const categoryName = categoryNames[timeAllocationKey] || timeAllocationKey;
        const firstRange = ranges[0];
        warnings.push(
          `Habit "${habit.name}" (${habit.startTime} - ${habit.endTime}) is outside the new ${categoryName} time ranges (e.g. ${firstRange.startTime} - ${firstRange.endTime})`
        );
      }
    }
  } catch (error) {
    console.error("[PROFILE ACTION] Error validating existing habits:", error);
  }

  return { warnings };
}

const profileSetupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  profession: z.string().min(1, "Profession is required"),
  pinCode: z.string().min(1, "Pin code is required"),
  // These are kept for backward compatibility and represent the first slot in each category
  personalWorkStart: z.string().min(1, "Personal Work start time is required"),
  personalWorkEnd: z.string().min(1, "Personal Work end time is required"),
  workBlockStart: z.string().min(1, "Work Block start time is required"),
  workBlockEnd: z.string().min(1, "Work Block end time is required"),
  productiveStart: z.string().min(1, "Productive start time is required"),
  productiveEnd: z.string().min(1, "Productive end time is required"),
  familyTimeStart: z.string().min(1, "Family Time start time is required"),
  familyTimeEnd: z.string().min(1, "Family Time end time is required"),
  journalStart: z.string().min(1, "Journal start time is required"),
  journalEnd: z.string().min(1, "Journal end time is required"),
});

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

export async function saveProfileSetup(formData: FormData) {
  try {
    const user = await requireAuth();
    await connectDB();

    const rawData = {
      name: (formData.get("name") as string) || "",
      dateOfBirth: (formData.get("dateOfBirth") as string) || "",
      profession: (formData.get("profession") as string) || "",
      pinCode: (formData.get("pinCode") as string) || "",
      // First slot per category (for backward compatibility)
      personalWorkStart: (formData.get("personalWorkStart") as string) || "",
      personalWorkEnd: (formData.get("personalWorkEnd") as string) || "",
      workBlockStart: (formData.get("workBlockStart") as string) || "",
      workBlockEnd: (formData.get("workBlockEnd") as string) || "",
      productiveStart: (formData.get("productiveStart") as string) || "",
      productiveEnd: (formData.get("productiveEnd") as string) || "",
      familyTimeStart: (formData.get("familyTimeStart") as string) || "",
      familyTimeEnd: (formData.get("familyTimeEnd") as string) || "",
      journalStart: (formData.get("journalStart") as string) || "",
      journalEnd: (formData.get("journalEnd") as string) || "",
    };

    const validatedData = profileSetupSchema.parse(rawData);

    // Parse full time ranges payload when available (supports multiple slots per category)
    const timeRangesRaw = formData.get("timeRanges") as string | null;
    let rangesPayload: any | null = null;
    if (timeRangesRaw) {
      try {
        rangesPayload = JSON.parse(timeRangesRaw);
      } catch (e) {
        console.error("[PROFILE ACTION] Invalid timeRanges payload in profile setup:", e);
        return { success: false, error: "Invalid time ranges data" };
      }
    }

    const categoriesConfig = [
      { key: "personalWork", name: "Personal Work" },
      { key: "workBlock", name: "Work Block" },
      { key: "productive", name: "Productive" },
      { key: "familyTime", name: "Family Time" },
      { key: "journal", name: "Journal" },
    ] as const;

    let personalWorkDuration = 0;
    let workBlockDuration = 0;
    let productiveDuration = 0;
    let familyTimeDuration = 0;
    let journalDuration = 0;

    type CategoryKey = (typeof categoriesConfig)[number]["key"];

    const categoryDurations: Record<CategoryKey, number> = {
      personalWork: 0,
      workBlock: 0,
      productive: 0,
      familyTime: 0,
      journal: 0,
    };

    const categoryRanges: Record<CategoryKey, { startTime: string; endTime: string }[]> = {
      personalWork: [],
      workBlock: [],
      productive: [],
      familyTime: [],
      journal: [],
    };

    if (rangesPayload) {
      // Build from full ranges payload
      for (const cfg of categoriesConfig) {
        const rawRanges = Array.isArray(rangesPayload[cfg.key])
          ? rangesPayload[cfg.key]
          : [];
        const cleanedRanges = rawRanges
          .filter((r: any) => r.startTime && r.endTime)
          .map((r: any) => ({
            startTime: r.startTime as string,
            endTime: r.endTime as string,
          }));

        if (!cleanedRanges.length) {
          return { success: false, error: `${cfg.name} must have at least one time slot` };
        }

        categoryRanges[cfg.key] = cleanedRanges;

        // Per-category overlap check (within same category)
        for (let i = 0; i < cleanedRanges.length; i++) {
          for (let j = i + 1; j < cleanedRanges.length; j++) {
            const r1 = cleanedRanges[i];
            const r2 = cleanedRanges[j];
            if (timeRangesOverlap(r1.startTime, r1.endTime, r2.startTime, r2.endTime)) {
              return {
                success: false,
                error: `${cfg.name} slots ${i + 1} and ${j + 1} overlap`,
              };
            }
          }
        }

        // Sum total minutes for this category
        const totalMinutesForCategory = cleanedRanges.reduce(
          (sum, r) => sum + calculateDuration(r.startTime, r.endTime),
          0
        );
        categoryDurations[cfg.key] = totalMinutesForCategory;
      }

      personalWorkDuration = categoryDurations.personalWork;
      workBlockDuration = categoryDurations.workBlock;
      productiveDuration = categoryDurations.productive;
      familyTimeDuration = categoryDurations.familyTime;
      journalDuration = categoryDurations.journal;
    } else {
      // Fallback: single-range-per-category behavior (legacy)
      personalWorkDuration = calculateDuration(
        validatedData.personalWorkStart,
        validatedData.personalWorkEnd
      );
      workBlockDuration = calculateDuration(
        validatedData.workBlockStart,
        validatedData.workBlockEnd
      );
      productiveDuration = calculateDuration(
        validatedData.productiveStart,
        validatedData.productiveEnd
      );
      familyTimeDuration = calculateDuration(
        validatedData.familyTimeStart,
        validatedData.familyTimeEnd
      );
      journalDuration = calculateDuration(
        validatedData.journalStart,
        validatedData.journalEnd
      );

      categoryRanges.personalWork = [
        { startTime: validatedData.personalWorkStart, endTime: validatedData.personalWorkEnd },
      ];
      categoryRanges.workBlock = [
        { startTime: validatedData.workBlockStart, endTime: validatedData.workBlockEnd },
      ];
      categoryRanges.productive = [
        { startTime: validatedData.productiveStart, endTime: validatedData.productiveEnd },
      ];
      categoryRanges.familyTime = [
        { startTime: validatedData.familyTimeStart, endTime: validatedData.familyTimeEnd },
      ];
      categoryRanges.journal = [
        { startTime: validatedData.journalStart, endTime: validatedData.journalEnd },
      ];
    }

    // Check total time doesn't exceed 24 hours
    const totalMinutes =
      personalWorkDuration +
      workBlockDuration +
      productiveDuration +
      familyTimeDuration +
      journalDuration;
    if (totalMinutes > 24 * 60) {
      return {
        success: false,
        error: `Total allocated time (${Math.floor(totalMinutes / 60)}h ${
          totalMinutes % 60
        }min) exceeds 24 hours`,
      };
    }

    const dob = new Date(validatedData.dateOfBirth);
    const age = calculateAge(dob);

    // Prepare time categories data from per-category ranges
    const timeCategoriesData = {
      personalWork: {
        ranges: categoryRanges.personalWork,
        totalHours: personalWorkDuration / 60,
        minAllocation: 50,
      },
      workBlock: {
        ranges: categoryRanges.workBlock,
        totalHours: workBlockDuration / 60,
        minAllocation: 50,
      },
      productive: {
        ranges: categoryRanges.productive,
        totalHours: productiveDuration / 60,
        minAllocation: 50,
      },
      familyTime: {
        ranges: categoryRanges.familyTime,
        totalHours: familyTimeDuration / 60,
        minAllocation: 50,
      },
      journaling: {
        ranges: categoryRanges.journal,
        totalHours: journalDuration / 60,
      },
    };

    console.log("[PROFILE ACTION] Storing time allocation ranges:", {
      personalWork: timeCategoriesData.personalWork.ranges,
      workBlock: timeCategoriesData.workBlock.ranges,
      productive: timeCategoriesData.productive.ranges,
      familyTime: timeCategoriesData.familyTime.ranges,
      journaling: timeCategoriesData.journaling.ranges,
    });

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      user.userId,
      {
        name: validatedData.name,
        dateOfBirth: dob,
        age: age,
        profession: validatedData.profession,
        pinCode: validatedData.pinCode,
        profileSetupCompleted: true,
        timeCategories: timeCategoriesData,
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      return { success: false, error: "User not found" };
    }

    // Verify time categories were saved
    console.log("[PROFILE ACTION] Time categories saved successfully:", {
      personalWork: updatedUser.timeCategories?.personalWork?.ranges || [],
      workBlock: updatedUser.timeCategories?.workBlock?.ranges || [],
      productive: updatedUser.timeCategories?.productive?.ranges || [],
      familyTime: updatedUser.timeCategories?.familyTime?.ranges || [],
      journaling: updatedUser.timeCategories?.journaling?.ranges || [],
    });

    // Create birthday event in calendar
    try {
      const birthdayDate = new Date(dob);
      const currentYear = new Date().getFullYear();
      birthdayDate.setFullYear(currentYear);
      
      // If birthday has passed this year, set for next year
      if (birthdayDate < new Date()) {
        birthdayDate.setFullYear(currentYear + 1);
      }

      await CalendarEvent.create({
        userId: new mongoose.Types.ObjectId(user.userId),
        title: `${validatedData.name}'s Birthday`,
        type: "birthday",
        description: `Happy Birthday! 🎉`,
        date: birthdayDate,
        reminder: {
          enabled: true,
          minutesBefore: 1440, // 1 day before
        },
        recurring: {
          enabled: true,
          frequency: "yearly",
          interval: 1,
        },
      });
    } catch (calendarError) {
      console.error("[PROFILE] Error creating birthday event:", calendarError);
      // Continue even if birthday event creation fails
    }

    return { success: true, user: JSON.parse(JSON.stringify(updatedUser)) };
  } catch (error: any) {
    console.error("[PROFILE ACTION] Error saving profile setup:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Validation error" };
    }
    return { success: false, error: error?.message || "Failed to save profile setup" };
  }
}

export async function checkProfileSetup() {
  try {
    const user = await requireAuth();
    await connectDB();

    const dbUser = await User.findById(user.userId).select("profileSetupCompleted").lean();

    if (!dbUser) {
      return { success: false, completed: false };
    }

    return { success: true, completed: dbUser.profileSetupCompleted || false };
  } catch (error: any) {
    console.error("[PROFILE ACTION] Error checking profile setup:", error);
    return { success: false, completed: false };
  }
}

export async function getUserProfile() {
  try {
    const user = await requireAuth();
    await connectDB();

    console.log("[PROFILE ACTION] Fetching profile for user:", user.userId);

    const dbUser = await User.findById(user.userId)
      .select("name email profilePicture dateOfBirth age profession pinCode timeCategories createdAt")
      .lean();

    if (!dbUser) {
      console.error("[PROFILE ACTION] User not found in database");
      return { success: false, error: "User not found" };
    }

    console.log("[PROFILE ACTION] Fetched user profile");
    console.log("[PROFILE ACTION] User has profilePicture:", !!dbUser.profilePicture);
    if (dbUser.profilePicture) {
      console.log("[PROFILE ACTION] Profile picture length:", dbUser.profilePicture.length);
      console.log("[PROFILE ACTION] Profile picture preview:", dbUser.profilePicture.substring(0, 50) + "...");
    } else {
      console.log("[PROFILE ACTION] No profile picture found in database");
    }

    // Ensure we're returning the profile picture
    const profileData = JSON.parse(JSON.stringify(dbUser));
    console.log("[PROFILE ACTION] Returning profile data with profilePicture:", !!profileData.profilePicture);

    return { success: true, profile: profileData };
  } catch (error: any) {
    console.error("[PROFILE ACTION] Error fetching user profile:", error);
    console.error("[PROFILE ACTION] Error stack:", error.stack);
    return { success: false, error: error.message || "Failed to fetch profile" };
  }
}

const updateTimeAllocationSchema = z.object({
  timeRanges: z
    .string()
    .transform((value) => {
      try {
        return JSON.parse(value);
      } catch {
        throw new Error("Invalid time ranges payload");
      }
    })
    .optional(),
});

export async function updateTimeAllocation(formData: FormData) {
  try {
    const user = await requireAuth();
    await connectDB();

    const rawData = {
      timeRanges: formData.get("timeRanges") as string | undefined,
    };

    const validatedData = updateTimeAllocationSchema.parse(rawData);

    const rangesPayload = (validatedData.timeRanges as any) || {};

    // Get current user to preserve existing values
    const currentUser = await User.findById(user.userId).lean();
    if (!currentUser) {
      return { success: false, error: "User not found" };
    }

    // Build update object from ranges payload, preserving existing values if not provided
    const timeCategoriesUpdate: any = {};

    const categories = ["personalWork", "workBlock", "productive", "familyTime", "journaling"] as const;

    categories.forEach((key) => {
      const incomingRanges = Array.isArray(rangesPayload[key]) ? rangesPayload[key] : undefined;
      const existingCategory = currentUser.timeCategories?.[key] as any;

      if (incomingRanges && incomingRanges.length) {
        const cleanedRanges = incomingRanges
          .filter((r: any) => r.startTime && r.endTime)
          .map((r: any) => ({
            startTime: r.startTime,
            endTime: r.endTime,
          }));

        const totalMinutes = cleanedRanges.reduce(
          (sum: number, r: any) => sum + calculateDuration(r.startTime, r.endTime),
          0
        );

        timeCategoriesUpdate[key] = {
          ranges: cleanedRanges,
          totalHours: totalMinutes / 60,
          ...(existingCategory && typeof existingCategory.minAllocation === "number"
            ? { minAllocation: existingCategory.minAllocation }
            : {}),
        };
      } else if (existingCategory) {
        // Preserve existing category if no new payload was provided
        timeCategoriesUpdate[key] = existingCategory;
      }
    });

    // Build the new time categories object
    const newTimeCategories = {
      ...(currentUser.timeCategories || {}),
      ...timeCategoriesUpdate,
    };

    // Validate existing habits against new time ranges
    const validationResult = await validateExistingHabits(user.userId, newTimeCategories);

    // Update user with new time categories
    const updatedUser = await User.findByIdAndUpdate(
      user.userId,
      {
        $set: {
          timeCategories: newTimeCategories,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      return { success: false, error: "Failed to update time allocation" };
    }

    return {
      success: true,
      profile: JSON.parse(JSON.stringify(updatedUser)),
      warnings: validationResult.warnings,
    };
  } catch (error: any) {
    console.error("[PROFILE ACTION] Error updating time allocation:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: error.message || "Failed to update time allocation" };
  }
}

export async function updateSingleTimeCategory(category: string, startTime: string, endTime: string) {
  try {
    const user = await requireAuth();
    await connectDB();

    // Validate category name
    const validCategories = ["personalWork", "workBlock", "productive", "familyTime", "journaling"];
    if (!validCategories.includes(category)) {
      return { success: false, error: "Invalid category" };
    }

    if (!startTime || !endTime) {
      return { success: false, error: "Start time and end time are required" };
    }

    // Get current user
    const currentUser = await User.findById(user.userId).lean();
    if (!currentUser) {
      return { success: false, error: "User not found" };
    }

    // Build update object - only update the specific category
    const timeCategoriesUpdate: any = {
      ...(currentUser.timeCategories || {}),
    };

    const duration = calculateDuration(startTime, endTime);
    const totalHours = duration / 60;
    
    // Update only the specific category by appending a new range
    if (category === "journaling") {
      const existing = currentUser.timeCategories?.journaling as any;
      const existingRanges = existing?.ranges || [];
      timeCategoriesUpdate.journaling = {
        ranges: [...existingRanges, { startTime, endTime }],
        totalHours: (existing?.totalHours || 0) + totalHours,
      };
    } else {
      const existing = (currentUser.timeCategories as any)?.[category] || {};
      const existingRanges = existing.ranges || [];
      timeCategoriesUpdate[category] = {
        ranges: [...existingRanges, { startTime, endTime }],
        totalHours: (existing.totalHours || 0) + totalHours,
        minAllocation: existing.minAllocation || 50,
      };
    }

    // Validate existing habits against new time range for this category
    const validationResult = await validateExistingHabits(user.userId, timeCategoriesUpdate);

    // Update user with new time category
    const updatedUser = await User.findByIdAndUpdate(
      user.userId,
      {
        $set: {
          timeCategories: timeCategoriesUpdate,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      return { success: false, error: "Failed to update time allocation" };
    }

    return {
      success: true,
      profile: JSON.parse(JSON.stringify(updatedUser)),
      warnings: validationResult.warnings,
    };
  } catch (error: any) {
    console.error("[PROFILE ACTION] Error updating single time category:", error);
    return { success: false, error: error.message || "Failed to update time allocation" };
  }
}

export async function updateProfilePicture(formData: FormData) {
  try {
    const user = await requireAuth();
    await connectDB();

    const profilePicture = formData.get("profilePicture") as string;

    if (!profilePicture) {
      return { success: false, error: "Profile picture is required" };
    }

    // Validate base64 string format
    if (!profilePicture.startsWith("data:image/")) {
      return { success: false, error: "Invalid image format" };
    }

    console.log("[PROFILE ACTION] Updating profile picture for user:", user.userId);
    console.log("[PROFILE ACTION] Profile picture length:", profilePicture.length);
    console.log("[PROFILE ACTION] Profile picture preview:", profilePicture.substring(0, 50) + "...");

    // First, verify the user exists
    const existingUser = await User.findById(user.userId);
    if (!existingUser) {
      console.error("[PROFILE ACTION] User not found");
      return { success: false, error: "User not found" };
    }

    // Update the profile picture
    existingUser.profilePicture = profilePicture;
    await existingUser.save();

    console.log("[PROFILE ACTION] Profile picture saved to database");

    // Fetch the updated user to verify
    const updatedUser = await User.findById(user.userId)
      .select("name email profilePicture dateOfBirth age profession pinCode timeCategories createdAt")
      .lean();

    if (!updatedUser) {
      console.error("[PROFILE ACTION] User not found after update");
      return { success: false, error: "Failed to update profile picture" };
    }

    console.log("[PROFILE ACTION] Profile picture updated successfully");
    console.log("[PROFILE ACTION] Updated user has profilePicture:", !!updatedUser.profilePicture);
    if (updatedUser.profilePicture) {
      console.log("[PROFILE ACTION] Saved profile picture length:", updatedUser.profilePicture.length);
      console.log("[PROFILE ACTION] Saved profile picture preview:", updatedUser.profilePicture.substring(0, 50) + "...");
    }

    return {
      success: true,
      profile: JSON.parse(JSON.stringify(updatedUser)),
    };
  } catch (error: any) {
    console.error("[PROFILE ACTION] Error updating profile picture:", error);
    console.error("[PROFILE ACTION] Error details:", error.message, error.stack);
    return { success: false, error: error.message || "Failed to update profile picture" };
  }
}
