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

// Validate existing habits against new time ranges
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
      if (!timeCategory.startTime || !timeCategory.endTime) continue;

      if (!isTimeRangeWithin(
        habit.startTime!,
        habit.endTime!,
        timeCategory.startTime,
        timeCategory.endTime
      )) {
        const categoryNames: { [key: string]: string } = {
          personalWork: "Personal",
          workBlock: "Work Block",
          productive: "Productive",
          familyTime: "Family Time",
          journaling: "Journal",
        };
        const categoryName = categoryNames[timeAllocationKey] || timeAllocationKey;
        warnings.push(
          `Habit "${habit.name}" (${habit.startTime} - ${habit.endTime}) is outside the new ${categoryName} Time range (${timeCategory.startTime} - ${timeCategory.endTime})`
        );
      }
    }
  } catch (error) {
    console.error("[PROFILE ACTION] Error validating existing habits:", error);
  }

  return { warnings };
}

// Time limits in minutes
const TIME_LIMITS = {
  personalWork: { min: 75, max: 150 }, // 1h15min - 2h30min
  workBlock: { min: 120, max: 240 }, // 2h - 4h
  productive: { min: 105, max: 210 }, // 1h45min - 3h30min
  familyTime: { min: 60, max: 120 }, // 1h - 2h
  journal: { min: 30, max: 60 }, // 30min - 1h
};

const profileSetupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  profession: z.string().min(1, "Profession is required"),
  pinCode: z.string().min(1, "Pin code is required"),
  // Personal Work
  personalWorkStart: z.string().min(1, "Personal Work start time is required"),
  personalWorkEnd: z.string().min(1, "Personal Work end time is required"),
  // Work Block
  workBlockStart: z.string().min(1, "Work Block start time is required"),
  workBlockEnd: z.string().min(1, "Work Block end time is required"),
  // Productive
  productiveStart: z.string().min(1, "Productive start time is required"),
  productiveEnd: z.string().min(1, "Productive end time is required"),
  // Family Time
  familyTimeStart: z.string().min(1, "Family Time start time is required"),
  familyTimeEnd: z.string().min(1, "Family Time end time is required"),
  // Journal
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
      // Personal Work
      personalWorkStart: (formData.get("personalWorkStart") as string) || "",
      personalWorkEnd: (formData.get("personalWorkEnd") as string) || "",
      // Work Block
      workBlockStart: (formData.get("workBlockStart") as string) || "",
      workBlockEnd: (formData.get("workBlockEnd") as string) || "",
      // Productive
      productiveStart: (formData.get("productiveStart") as string) || "",
      productiveEnd: (formData.get("productiveEnd") as string) || "",
      // Family Time
      familyTimeStart: (formData.get("familyTimeStart") as string) || "",
      familyTimeEnd: (formData.get("familyTimeEnd") as string) || "",
      // Journal
      journalStart: (formData.get("journalStart") as string) || "",
      journalEnd: (formData.get("journalEnd") as string) || "",
    };

    const validatedData = profileSetupSchema.parse(rawData);

    // Validate durations
    const personalWorkDuration = calculateDuration(validatedData.personalWorkStart, validatedData.personalWorkEnd);
    const workBlockDuration = calculateDuration(validatedData.workBlockStart, validatedData.workBlockEnd);
    const productiveDuration = calculateDuration(validatedData.productiveStart, validatedData.productiveEnd);
    const familyTimeDuration = calculateDuration(validatedData.familyTimeStart, validatedData.familyTimeEnd);
    const journalDuration = calculateDuration(validatedData.journalStart, validatedData.journalEnd);

    // Check duration limits with detailed error messages
    const personalWorkHours = Math.floor(personalWorkDuration / 60);
    const personalWorkMins = personalWorkDuration % 60;
    const personalWorkMinHours = Math.floor(TIME_LIMITS.personalWork.min / 60);
    const personalWorkMinMins = TIME_LIMITS.personalWork.min % 60;
    const personalWorkMaxHours = Math.floor(TIME_LIMITS.personalWork.max / 60);
    const personalWorkMaxMins = TIME_LIMITS.personalWork.max % 60;
    
    if (personalWorkDuration < TIME_LIMITS.personalWork.min) {
      return { success: false, error: `Personal Work duration (${personalWorkHours}h ${personalWorkMins}min) is less than the minimum required time of ${personalWorkMinHours}h ${personalWorkMinMins}min` };
    } else if (personalWorkDuration > TIME_LIMITS.personalWork.max) {
      return { success: false, error: `Personal Work duration (${personalWorkHours}h ${personalWorkMins}min) exceeds the maximum allowed time of ${personalWorkMaxHours}h ${personalWorkMaxMins}min` };
    }
    
    const workBlockHours = Math.floor(workBlockDuration / 60);
    const workBlockMins = workBlockDuration % 60;
    const workBlockMinHours = Math.floor(TIME_LIMITS.workBlock.min / 60);
    const workBlockMinMins = TIME_LIMITS.workBlock.min % 60;
    const workBlockMaxHours = Math.floor(TIME_LIMITS.workBlock.max / 60);
    const workBlockMaxMins = TIME_LIMITS.workBlock.max % 60;
    
    if (workBlockDuration < TIME_LIMITS.workBlock.min) {
      return { success: false, error: `Work Block duration (${workBlockHours}h ${workBlockMins}min) is less than the minimum required time of ${workBlockMinHours}h ${workBlockMinMins}min` };
    } else if (workBlockDuration > TIME_LIMITS.workBlock.max) {
      return { success: false, error: `Work Block duration (${workBlockHours}h ${workBlockMins}min) exceeds the maximum allowed time of ${workBlockMaxHours}h ${workBlockMaxMins}min` };
    }
    
    const productiveHours = Math.floor(productiveDuration / 60);
    const productiveMins = productiveDuration % 60;
    const productiveMinHours = Math.floor(TIME_LIMITS.productive.min / 60);
    const productiveMinMins = TIME_LIMITS.productive.min % 60;
    const productiveMaxHours = Math.floor(TIME_LIMITS.productive.max / 60);
    const productiveMaxMins = TIME_LIMITS.productive.max % 60;
    
    if (productiveDuration < TIME_LIMITS.productive.min) {
      return { success: false, error: `Productive duration (${productiveHours}h ${productiveMins}min) is less than the minimum required time of ${productiveMinHours}h ${productiveMinMins}min` };
    } else if (productiveDuration > TIME_LIMITS.productive.max) {
      return { success: false, error: `Productive duration (${productiveHours}h ${productiveMins}min) exceeds the maximum allowed time of ${productiveMaxHours}h ${productiveMaxMins}min` };
    }
    
    const familyTimeHours = Math.floor(familyTimeDuration / 60);
    const familyTimeMins = familyTimeDuration % 60;
    const familyTimeMinHours = Math.floor(TIME_LIMITS.familyTime.min / 60);
    const familyTimeMinMins = TIME_LIMITS.familyTime.min % 60;
    const familyTimeMaxHours = Math.floor(TIME_LIMITS.familyTime.max / 60);
    const familyTimeMaxMins = TIME_LIMITS.familyTime.max % 60;
    
    if (familyTimeDuration < TIME_LIMITS.familyTime.min) {
      return { success: false, error: `Family Time duration (${familyTimeHours}h ${familyTimeMins}min) is less than the minimum required time of ${familyTimeMinHours}h ${familyTimeMinMins}min` };
    } else if (familyTimeDuration > TIME_LIMITS.familyTime.max) {
      return { success: false, error: `Family Time duration (${familyTimeHours}h ${familyTimeMins}min) exceeds the maximum allowed time of ${familyTimeMaxHours}h ${familyTimeMaxMins}min` };
    }
    
    const journalHours = Math.floor(journalDuration / 60);
    const journalMins = journalDuration % 60;
    const journalMinHours = Math.floor(TIME_LIMITS.journal.min / 60);
    const journalMinMins = TIME_LIMITS.journal.min % 60;
    const journalMaxHours = Math.floor(TIME_LIMITS.journal.max / 60);
    const journalMaxMins = TIME_LIMITS.journal.max % 60;
    
    if (journalDuration < TIME_LIMITS.journal.min) {
      return { success: false, error: `Journal duration (${journalHours}h ${journalMins}min) is less than the minimum required time of ${journalMinHours}h ${journalMinMins}min` };
    } else if (journalDuration > TIME_LIMITS.journal.max) {
      return { success: false, error: `Journal duration (${journalHours}h ${journalMins}min) exceeds the maximum allowed time of ${journalMaxHours}h ${journalMaxMins}min` };
    }

    // Check total time doesn't exceed 24 hours
    const totalMinutes = personalWorkDuration + workBlockDuration + productiveDuration + familyTimeDuration + journalDuration;
    if (totalMinutes > 24 * 60) {
      return { success: false, error: `Total allocated time (${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}min) exceeds 24 hours` };
    }

    // Check for overlaps (simplified - check if any ranges overlap)
    const timeRanges = [
      { start: validatedData.personalWorkStart, end: validatedData.personalWorkEnd, name: "Personal Work" },
      { start: validatedData.workBlockStart, end: validatedData.workBlockEnd, name: "Work Block" },
      { start: validatedData.productiveStart, end: validatedData.productiveEnd, name: "Productive" },
      { start: validatedData.familyTimeStart, end: validatedData.familyTimeEnd, name: "Family Time" },
      { start: validatedData.journalStart, end: validatedData.journalEnd, name: "Journal" },
    ];

    for (let i = 0; i < timeRanges.length; i++) {
      for (let j = i + 1; j < timeRanges.length; j++) {
        const range1 = timeRanges[i];
        const range2 = timeRanges[j];
        
        const s1 = timeToMinutes(range1.start);
        const e1 = timeToMinutes(range1.end);
        const s2 = timeToMinutes(range2.start);
        const e2 = timeToMinutes(range2.end);
        
        const wraps1 = e1 < s1;
        const wraps2 = e2 < s2;
        
        let overlaps = false;
        if (wraps1 && wraps2) {
          overlaps = true;
        } else if (wraps1) {
          overlaps = (s2 >= s1 && s2 < 24 * 60) || (e2 > 0 && e2 <= e1) || (s2 < e1);
        } else if (wraps2) {
          overlaps = (s1 >= s2 && s1 < 24 * 60) || (e1 > 0 && e1 <= e2) || (s1 < e2);
        } else {
          overlaps = !(e1 <= s2 || e2 <= s1);
        }
        
        if (overlaps) {
          return { success: false, error: `${range1.name} overlaps with ${range2.name}` };
        }
      }
    }

    const dob = new Date(validatedData.dateOfBirth);
    const age = calculateAge(dob);

    // Calculate total hours for each category (for database storage)
    const personalWorkTotalHours = personalWorkDuration / 60;
    const workBlockTotalHours = workBlockDuration / 60;
    const productiveTotalHours = productiveDuration / 60;
    const familyTimeTotalHours = familyTimeDuration / 60;
    const journalTotalHours = journalDuration / 60;

    // Prepare time categories data
    const timeCategoriesData = {
      personalWork: {
        startTime: validatedData.personalWorkStart,
        endTime: validatedData.personalWorkEnd,
        totalHours: personalWorkTotalHours,
        minAllocation: 50, // Default min allocation percentage
      },
      workBlock: {
        startTime: validatedData.workBlockStart,
        endTime: validatedData.workBlockEnd,
        totalHours: workBlockTotalHours,
        minAllocation: 50, // Default min allocation percentage
      },
      productive: {
        startTime: validatedData.productiveStart,
        endTime: validatedData.productiveEnd,
        totalHours: productiveTotalHours,
        minAllocation: 50, // Default min allocation percentage
      },
      familyTime: {
        startTime: validatedData.familyTimeStart,
        endTime: validatedData.familyTimeEnd,
        totalHours: familyTimeTotalHours,
        minAllocation: 50, // Default min allocation percentage
      },
      journaling: {
        startTime: validatedData.journalStart,
        endTime: validatedData.journalEnd,
        totalHours: journalTotalHours,
      },
    };

    console.log("[PROFILE ACTION] Storing time allocation ranges:", {
      personalWork: `${timeCategoriesData.personalWork.startTime} - ${timeCategoriesData.personalWork.endTime}`,
      workBlock: `${timeCategoriesData.workBlock.startTime} - ${timeCategoriesData.workBlock.endTime}`,
      productive: `${timeCategoriesData.productive.startTime} - ${timeCategoriesData.productive.endTime}`,
      familyTime: `${timeCategoriesData.familyTime.startTime} - ${timeCategoriesData.familyTime.endTime}`,
      journaling: `${timeCategoriesData.journaling.startTime} - ${timeCategoriesData.journaling.endTime}`,
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
      personalWork: updatedUser.timeCategories?.personalWork ? `${updatedUser.timeCategories.personalWork.startTime} - ${updatedUser.timeCategories.personalWork.endTime}` : "Not saved",
      workBlock: updatedUser.timeCategories?.workBlock ? `${updatedUser.timeCategories.workBlock.startTime} - ${updatedUser.timeCategories.workBlock.endTime}` : "Not saved",
      productive: updatedUser.timeCategories?.productive ? `${updatedUser.timeCategories.productive.startTime} - ${updatedUser.timeCategories.productive.endTime}` : "Not saved",
      familyTime: updatedUser.timeCategories?.familyTime ? `${updatedUser.timeCategories.familyTime.startTime} - ${updatedUser.timeCategories.familyTime.endTime}` : "Not saved",
      journaling: updatedUser.timeCategories?.journaling ? `${updatedUser.timeCategories.journaling.startTime} - ${updatedUser.timeCategories.journaling.endTime}` : "Not saved",
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
  personalWorkStart: z.string().optional(),
  personalWorkEnd: z.string().optional(),
  workBlockStart: z.string().optional(),
  workBlockEnd: z.string().optional(),
  productiveStart: z.string().optional(),
  productiveEnd: z.string().optional(),
  familyTimeStart: z.string().optional(),
  familyTimeEnd: z.string().optional(),
  journalStart: z.string().optional(),
  journalEnd: z.string().optional(),
});

export async function updateTimeAllocation(formData: FormData) {
  try {
    const user = await requireAuth();
    await connectDB();

    const rawData = {
      personalWorkStart: formData.get("personalWorkStart") as string | undefined,
      personalWorkEnd: formData.get("personalWorkEnd") as string | undefined,
      workBlockStart: formData.get("workBlockStart") as string | undefined,
      workBlockEnd: formData.get("workBlockEnd") as string | undefined,
      productiveStart: formData.get("productiveStart") as string | undefined,
      productiveEnd: formData.get("productiveEnd") as string | undefined,
      familyTimeStart: formData.get("familyTimeStart") as string | undefined,
      familyTimeEnd: formData.get("familyTimeEnd") as string | undefined,
      journalStart: formData.get("journalStart") as string | undefined,
      journalEnd: formData.get("journalEnd") as string | undefined,
    };

    const validatedData = updateTimeAllocationSchema.parse(rawData);

    // Validate durations if times are provided
    if (validatedData.personalWorkStart && validatedData.personalWorkEnd) {
      const duration = calculateDuration(validatedData.personalWorkStart, validatedData.personalWorkEnd);
      const currentHours = Math.floor(duration / 60);
      const currentMins = duration % 60;
      const minHours = Math.floor(TIME_LIMITS.personalWork.min / 60);
      const minMins = TIME_LIMITS.personalWork.min % 60;
      const maxHours = Math.floor(TIME_LIMITS.personalWork.max / 60);
      const maxMins = TIME_LIMITS.personalWork.max % 60;
      
      if (duration < TIME_LIMITS.personalWork.min) {
        return { success: false, error: `Personal Work duration (${currentHours}h ${currentMins}min) is less than the minimum required time of ${minHours}h ${minMins}min` };
      } else if (duration > TIME_LIMITS.personalWork.max) {
        return { success: false, error: `Personal Work duration (${currentHours}h ${currentMins}min) exceeds the maximum allowed time of ${maxHours}h ${maxMins}min` };
      }
    }
    if (validatedData.workBlockStart && validatedData.workBlockEnd) {
      const duration = calculateDuration(validatedData.workBlockStart, validatedData.workBlockEnd);
      const currentHours = Math.floor(duration / 60);
      const currentMins = duration % 60;
      const minHours = Math.floor(TIME_LIMITS.workBlock.min / 60);
      const minMins = TIME_LIMITS.workBlock.min % 60;
      const maxHours = Math.floor(TIME_LIMITS.workBlock.max / 60);
      const maxMins = TIME_LIMITS.workBlock.max % 60;
      
      if (duration < TIME_LIMITS.workBlock.min) {
        return { success: false, error: `Work Block duration (${currentHours}h ${currentMins}min) is less than the minimum required time of ${minHours}h ${minMins}min` };
      } else if (duration > TIME_LIMITS.workBlock.max) {
        return { success: false, error: `Work Block duration (${currentHours}h ${currentMins}min) exceeds the maximum allowed time of ${maxHours}h ${maxMins}min` };
      }
    }
    if (validatedData.productiveStart && validatedData.productiveEnd) {
      const duration = calculateDuration(validatedData.productiveStart, validatedData.productiveEnd);
      const currentHours = Math.floor(duration / 60);
      const currentMins = duration % 60;
      const minHours = Math.floor(TIME_LIMITS.productive.min / 60);
      const minMins = TIME_LIMITS.productive.min % 60;
      const maxHours = Math.floor(TIME_LIMITS.productive.max / 60);
      const maxMins = TIME_LIMITS.productive.max % 60;
      
      if (duration < TIME_LIMITS.productive.min) {
        return { success: false, error: `Productive duration (${currentHours}h ${currentMins}min) is less than the minimum required time of ${minHours}h ${minMins}min` };
      } else if (duration > TIME_LIMITS.productive.max) {
        return { success: false, error: `Productive duration (${currentHours}h ${currentMins}min) exceeds the maximum allowed time of ${maxHours}h ${maxMins}min` };
      }
    }
    if (validatedData.familyTimeStart && validatedData.familyTimeEnd) {
      const duration = calculateDuration(validatedData.familyTimeStart, validatedData.familyTimeEnd);
      const currentHours = Math.floor(duration / 60);
      const currentMins = duration % 60;
      const minHours = Math.floor(TIME_LIMITS.familyTime.min / 60);
      const minMins = TIME_LIMITS.familyTime.min % 60;
      const maxHours = Math.floor(TIME_LIMITS.familyTime.max / 60);
      const maxMins = TIME_LIMITS.familyTime.max % 60;
      
      if (duration < TIME_LIMITS.familyTime.min) {
        return { success: false, error: `Family Time duration (${currentHours}h ${currentMins}min) is less than the minimum required time of ${minHours}h ${minMins}min` };
      } else if (duration > TIME_LIMITS.familyTime.max) {
        return { success: false, error: `Family Time duration (${currentHours}h ${currentMins}min) exceeds the maximum allowed time of ${maxHours}h ${maxMins}min` };
      }
    }
    if (validatedData.journalStart && validatedData.journalEnd) {
      const duration = calculateDuration(validatedData.journalStart, validatedData.journalEnd);
      const currentHours = Math.floor(duration / 60);
      const currentMins = duration % 60;
      const minHours = Math.floor(TIME_LIMITS.journal.min / 60);
      const minMins = TIME_LIMITS.journal.min % 60;
      const maxHours = Math.floor(TIME_LIMITS.journal.max / 60);
      const maxMins = TIME_LIMITS.journal.max % 60;
      
      if (duration < TIME_LIMITS.journal.min) {
        return { success: false, error: `Journal duration (${currentHours}h ${currentMins}min) is less than the minimum required time of ${minHours}h ${minMins}min` };
      } else if (duration > TIME_LIMITS.journal.max) {
        return { success: false, error: `Journal duration (${currentHours}h ${currentMins}min) exceeds the maximum allowed time of ${maxHours}h ${maxMins}min` };
      }
    }

    // Get current user to preserve existing values
    const currentUser = await User.findById(user.userId).lean();
    if (!currentUser) {
      return { success: false, error: "User not found" };
    }

    // Build update object, preserving existing values if not provided
    const timeCategoriesUpdate: any = {};

    if (currentUser.timeCategories) {
      // Personal Work
      if (currentUser.timeCategories.personalWork) {
        const startTime = validatedData.personalWorkStart ?? currentUser.timeCategories.personalWork.startTime;
        const endTime = validatedData.personalWorkEnd ?? currentUser.timeCategories.personalWork.endTime;
        const duration = startTime && endTime ? calculateDuration(startTime, endTime) : 0;
        timeCategoriesUpdate.personalWork = {
          startTime,
          endTime,
          totalHours: duration / 60,
        };
      } else if (validatedData.personalWorkStart && validatedData.personalWorkEnd) {
        const duration = calculateDuration(validatedData.personalWorkStart, validatedData.personalWorkEnd);
        timeCategoriesUpdate.personalWork = {
          startTime: validatedData.personalWorkStart,
          endTime: validatedData.personalWorkEnd,
          totalHours: duration / 60,
        };
      }

      // Work Block
      if (currentUser.timeCategories.workBlock) {
        const startTime = validatedData.workBlockStart ?? currentUser.timeCategories.workBlock.startTime;
        const endTime = validatedData.workBlockEnd ?? currentUser.timeCategories.workBlock.endTime;
        const duration = startTime && endTime ? calculateDuration(startTime, endTime) : 0;
        timeCategoriesUpdate.workBlock = {
          startTime,
          endTime,
          totalHours: duration / 60,
        };
      } else if (validatedData.workBlockStart && validatedData.workBlockEnd) {
        const duration = calculateDuration(validatedData.workBlockStart, validatedData.workBlockEnd);
        timeCategoriesUpdate.workBlock = {
          startTime: validatedData.workBlockStart,
          endTime: validatedData.workBlockEnd,
          totalHours: duration / 60,
        };
      }

      // Productive
      if (currentUser.timeCategories.productive) {
        const startTime = validatedData.productiveStart ?? currentUser.timeCategories.productive.startTime;
        const endTime = validatedData.productiveEnd ?? currentUser.timeCategories.productive.endTime;
        const duration = startTime && endTime ? calculateDuration(startTime, endTime) : 0;
        timeCategoriesUpdate.productive = {
          startTime,
          endTime,
          totalHours: duration / 60,
        };
      } else if (validatedData.productiveStart && validatedData.productiveEnd) {
        const duration = calculateDuration(validatedData.productiveStart, validatedData.productiveEnd);
        timeCategoriesUpdate.productive = {
          startTime: validatedData.productiveStart,
          endTime: validatedData.productiveEnd,
          totalHours: duration / 60,
        };
      }

      // Family Time
      if (currentUser.timeCategories.familyTime) {
        const startTime = validatedData.familyTimeStart ?? currentUser.timeCategories.familyTime.startTime;
        const endTime = validatedData.familyTimeEnd ?? currentUser.timeCategories.familyTime.endTime;
        const duration = startTime && endTime ? calculateDuration(startTime, endTime) : 0;
        timeCategoriesUpdate.familyTime = {
          startTime,
          endTime,
          totalHours: duration / 60,
        };
      } else if (validatedData.familyTimeStart && validatedData.familyTimeEnd) {
        const duration = calculateDuration(validatedData.familyTimeStart, validatedData.familyTimeEnd);
        timeCategoriesUpdate.familyTime = {
          startTime: validatedData.familyTimeStart,
          endTime: validatedData.familyTimeEnd,
          totalHours: duration / 60,
        };
      }

      // Journaling
      if (currentUser.timeCategories.journaling) {
        const startTime = validatedData.journalStart ?? currentUser.timeCategories.journaling.startTime;
        const endTime = validatedData.journalEnd ?? currentUser.timeCategories.journaling.endTime;
        const duration = startTime && endTime ? calculateDuration(startTime, endTime) : 0;
        timeCategoriesUpdate.journaling = {
          startTime,
          endTime,
          totalHours: duration / 60,
        };
      } else if (validatedData.journalStart && validatedData.journalEnd) {
        const duration = calculateDuration(validatedData.journalStart, validatedData.journalEnd);
        timeCategoriesUpdate.journaling = {
          startTime: validatedData.journalStart,
          endTime: validatedData.journalEnd,
          totalHours: duration / 60,
        };
      }
    } else {
      // If no timeCategories exist, create new ones
      if (validatedData.personalWorkStart && validatedData.personalWorkEnd) {
        const duration = calculateDuration(validatedData.personalWorkStart, validatedData.personalWorkEnd);
        timeCategoriesUpdate.personalWork = {
          startTime: validatedData.personalWorkStart,
          endTime: validatedData.personalWorkEnd,
          totalHours: duration / 60,
        };
      }
      if (validatedData.workBlockStart && validatedData.workBlockEnd) {
        const duration = calculateDuration(validatedData.workBlockStart, validatedData.workBlockEnd);
        timeCategoriesUpdate.workBlock = {
          startTime: validatedData.workBlockStart,
          endTime: validatedData.workBlockEnd,
          totalHours: duration / 60,
        };
      }
      if (validatedData.productiveStart && validatedData.productiveEnd) {
        const duration = calculateDuration(validatedData.productiveStart, validatedData.productiveEnd);
        timeCategoriesUpdate.productive = {
          startTime: validatedData.productiveStart,
          endTime: validatedData.productiveEnd,
          totalHours: duration / 60,
        };
      }
      if (validatedData.familyTimeStart && validatedData.familyTimeEnd) {
        const duration = calculateDuration(validatedData.familyTimeStart, validatedData.familyTimeEnd);
        timeCategoriesUpdate.familyTime = {
          startTime: validatedData.familyTimeStart,
          endTime: validatedData.familyTimeEnd,
          totalHours: duration / 60,
        };
      }
      if (validatedData.journalStart && validatedData.journalEnd) {
        const duration = calculateDuration(validatedData.journalStart, validatedData.journalEnd);
        timeCategoriesUpdate.journaling = {
          startTime: validatedData.journalStart,
          endTime: validatedData.journalEnd,
          totalHours: duration / 60,
        };
      }
    }

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

    // Map category name for TIME_LIMITS
    const categoryKey = category === "journaling" ? "journal" : category;
    const limits = TIME_LIMITS[categoryKey as keyof typeof TIME_LIMITS];
    if (!limits) {
      return { success: false, error: "Invalid category limits" };
    }

    // Validate duration
    const duration = calculateDuration(startTime, endTime);
    const currentHours = Math.floor(duration / 60);
    const currentMins = duration % 60;
    const minHours = Math.floor(limits.min / 60);
    const minMins = limits.min % 60;
    const maxHours = Math.floor(limits.max / 60);
    const maxMins = limits.max % 60;
    
    if (duration < limits.min) {
      return { success: false, error: `${category} duration (${currentHours}h ${currentMins}min) is less than the minimum required time of ${minHours}h ${minMins}min` };
    } else if (duration > limits.max) {
      return { success: false, error: `${category} duration (${currentHours}h ${currentMins}min) exceeds the maximum allowed time of ${maxHours}h ${maxMins}min` };
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

    const totalHours = duration / 60;
    
    // Update only the specific category
    if (category === "journaling") {
      timeCategoriesUpdate.journaling = {
        startTime,
        endTime,
        totalHours,
      };
    } else {
      timeCategoriesUpdate[category] = {
        startTime,
        endTime,
        totalHours,
        minAllocation: timeCategoriesUpdate[category]?.minAllocation || 50,
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
