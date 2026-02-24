"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { getUserProfile, updateTimeAllocation, updateProfilePicture, updateSingleTimeCategory } from "@/app/actions/profile";
import { getTodayJournalCount } from "@/app/actions/journal";
import { LogOut, Moon, Sun, User, Mail, Calendar, Briefcase, MapPin, Clock, Target, BookOpen, Users, Edit2, Save, X, Plus, Minus } from "lucide-react";
import Navigation from "@/components/Navigation";
import ProfilePicture from "@/components/ProfilePicture";
import { useTheme } from "@/components/ThemeProvider";
import { format } from "date-fns";

// Time limits in minutes
const TIME_LIMITS = {
  personalWork: { min: 75, max: 150 }, // 1h15min - 2h30min
  workBlock: { min: 120, max: 240 }, // 2h - 4h
  productive: { min: 105, max: 210 }, // 1h45min - 3h30min
  familyTime: { min: 60, max: 120 }, // 1h - 2h
  journal: { min: 30, max: 60 }, // 30min - 1h
};

// Helper function to convert time string (HH:MM) to minutes
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper function to convert 24-hour time to 12-hour format
function formatTime12Hour(time24: string): string {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
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

// Helper function to convert minutes to time string (HH:MM)
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Helper function to adjust duration by keeping start time fixed and adjusting end time
function adjustDuration(
  startTime: string,
  currentEndTime: string,
  adjustmentMinutes: number,
  minDuration: number,
  maxDuration: number
): string | null {
  if (!startTime || !currentEndTime) return null;
  
  const currentDuration = calculateDuration(startTime, currentEndTime);
  const newDuration = currentDuration + adjustmentMinutes;
  
  // Check if new duration is within limits
  if (newDuration < minDuration || newDuration > maxDuration) {
    return null; // Invalid adjustment
  }
  
  const startMinutes = timeToMinutes(startTime);
  let newEndMinutes = startMinutes + newDuration;
  
  // Handle wrapping around midnight - normalize to 0-1439 range
  if (newEndMinutes >= 24 * 60) {
    newEndMinutes = newEndMinutes % (24 * 60);
  } else if (newEndMinutes < 0) {
    newEndMinutes = (24 * 60) + (newEndMinutes % (24 * 60));
  }
  
  return minutesToTime(newEndMinutes);
}

export default function ProfilePage() {
  const router = useRouter();
  const { darkMode, toggleTheme, mounted } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingTimeAllocation, setEditingTimeAllocation] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [timeAllocationForm, setTimeAllocationForm] = useState<any>({});
  const [savingTimeAllocation, setSavingTimeAllocation] = useState(false);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [timeAllocationError, setTimeAllocationError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [savingProfilePicture, setSavingProfilePicture] = useState(false);
  const [profilePictureError, setProfilePictureError] = useState("");
  const [timeAllocationWarnings, setTimeAllocationWarnings] = useState<string[]>([]);

  useEffect(() => {
    async function loadProfile() {
      const result = await getUserProfile();
      if (result.success && result.profile) {
        console.log("[PROFILE PAGE] Profile loaded");
        console.log("[PROFILE PAGE] Profile picture exists:", !!result.profile.profilePicture);
        if (result.profile.profilePicture) {
          console.log("[PROFILE PAGE] Profile picture length:", result.profile.profilePicture.length);
        }
        setProfile(result.profile);
        // Initialize form with current values
        if (result.profile.timeCategories) {
          setTimeAllocationForm({
            personalWorkStart: result.profile.timeCategories.personalWork?.startTime || "",
            personalWorkEnd: result.profile.timeCategories.personalWork?.endTime || "",
            workBlockStart: result.profile.timeCategories.workBlock?.startTime || "",
            workBlockEnd: result.profile.timeCategories.workBlock?.endTime || "",
            productiveStart: result.profile.timeCategories.productive?.startTime || "",
            productiveEnd: result.profile.timeCategories.productive?.endTime || "",
            familyTimeStart: result.profile.timeCategories.familyTime?.startTime || "",
            familyTimeEnd: result.profile.timeCategories.familyTime?.endTime || "",
            journalStart: result.profile.timeCategories.journaling?.startTime || "",
            journalEnd: result.profile.timeCategories.journaling?.endTime || "",
          });
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, []);


  function validateTimeAllocation(): Record<string, string> {
    const errors: Record<string, string> = {};
    const timeBlocks: Array<{
      key: string;
      name: string;
      start: string;
      end: string;
      limits: { min: number; max: number };
    }> = [
      {
        key: "personalWork",
        name: "Personal Work",
        start: timeAllocationForm.personalWorkStart,
        end: timeAllocationForm.personalWorkEnd,
        limits: TIME_LIMITS.personalWork,
      },
      {
        key: "workBlock",
        name: "Work Block",
        start: timeAllocationForm.workBlockStart,
        end: timeAllocationForm.workBlockEnd,
        limits: TIME_LIMITS.workBlock,
      },
      {
        key: "productive",
        name: "Productive",
        start: timeAllocationForm.productiveStart,
        end: timeAllocationForm.productiveEnd,
        limits: TIME_LIMITS.productive,
      },
      {
        key: "familyTime",
        name: "Family Time",
        start: timeAllocationForm.familyTimeStart,
        end: timeAllocationForm.familyTimeEnd,
        limits: TIME_LIMITS.familyTime,
      },
      {
        key: "journal",
        name: "Journal",
        start: timeAllocationForm.journalStart,
        end: timeAllocationForm.journalEnd,
        limits: TIME_LIMITS.journal,
      },
    ];

    // Validate each time block
    timeBlocks.forEach((block) => {
      if (!block.start || !block.end) {
        errors[`${block.key}Start`] = `${block.name} start time is required`;
        errors[`${block.key}End`] = `${block.name} end time is required`;
        return;
      }

      const duration = calculateDuration(block.start, block.end);
      const minHours = Math.floor(block.limits.min / 60);
      const minMins = block.limits.min % 60;
      const maxHours = Math.floor(block.limits.max / 60);
      const maxMins = block.limits.max % 60;
      const currentHours = Math.floor(duration / 60);
      const currentMins = duration % 60;

      // Validate minimum time limit
      if (duration < block.limits.min) {
        errors[`${block.key}Duration`] = `${block.name} duration (${currentHours}h ${currentMins}min) is less than the minimum required time of ${minHours}h ${minMins}min. Please increase the duration.`;
      } 
      // Validate maximum time limit
      else if (duration > block.limits.max) {
        errors[`${block.key}Duration`] = `${block.name} duration (${currentHours}h ${currentMins}min) exceeds the maximum allowed time of ${maxHours}h ${maxMins}min. Please decrease the duration.`;
      }
    });

    // Check for overlaps
    for (let i = 0; i < timeBlocks.length; i++) {
      for (let j = i + 1; j < timeBlocks.length; j++) {
        const block1 = timeBlocks[i];
        const block2 = timeBlocks[j];
        
        if (block1.start && block1.end && block2.start && block2.end) {
          if (timeRangesOverlap(block1.start, block1.end, block2.start, block2.end)) {
            errors[`${block1.key}Overlap`] = `${block1.name} overlaps with ${block2.name}`;
            errors[`${block2.key}Overlap`] = `${block2.name} overlaps with ${block1.name}`;
          }
        }
      }
    }

    // Check total time doesn't exceed 24 hours
    const totalMinutes = timeBlocks.reduce((sum, block) => {
      if (block.start && block.end) {
        return sum + calculateDuration(block.start, block.end);
      }
      return sum;
    }, 0);

    if (totalMinutes > 24 * 60) {
      errors.totalTime = `Total allocated time (${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}min) exceeds 24 hours`;
    }

    setValidationErrors(errors);
    return errors;
  }

  async function handleSaveTimeAllocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingTimeAllocation(true);
    setTimeAllocationError("");

    // Validate time allocation
    const errors = validateTimeAllocation();
    if (Object.keys(errors).length > 0) {
      setTimeAllocationError("Please fix the validation errors before saving.");
      setSavingTimeAllocation(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const result = await updateTimeAllocation(formData);

    if (result.success && result.profile) {
      setProfile(result.profile);
      setEditingTimeAllocation(false);
      // Show warnings if any habits are outside the new range
      if (result.warnings && result.warnings.length > 0) {
        setTimeAllocationWarnings(result.warnings);
      } else {
        setTimeAllocationWarnings([]);
      }
      router.refresh();
    } else {
      setTimeAllocationError(result.error || "Failed to update time allocation");
      setTimeAllocationWarnings([]);
    }
    setSavingTimeAllocation(false);
  }

  async function handleSaveSingleCategory(category: string) {
    const categoryKey = category === "journaling" ? "journal" : category;
    const startKey = category === "journaling" ? "journalStart" : `${category}Start`;
    const endKey = category === "journaling" ? "journalEnd" : `${category}End`;
    
    const startTime = timeAllocationForm[startKey];
    const endTime = timeAllocationForm[endKey];

    if (!startTime || !endTime) {
      setTimeAllocationError(`${category} start and end times are required`);
      return;
    }

    setSavingCategory(category);
    setTimeAllocationError("");

    const result = await updateSingleTimeCategory(category, startTime, endTime);

    if (result.success && result.profile) {
      setProfile(result.profile);
      setEditingCategory(null);
      // Update form with saved values
      setTimeAllocationForm({
        ...timeAllocationForm,
        [startKey]: startTime,
        [endKey]: endTime,
      });
      // Show warnings if any habits are outside the new range
      if (result.warnings && result.warnings.length > 0) {
        setTimeAllocationWarnings(result.warnings);
      } else {
        setTimeAllocationWarnings([]);
      }
      router.refresh();
    } else {
      setTimeAllocationError(result.error || `Failed to update ${category}`);
      setTimeAllocationWarnings([]);
    }
    setSavingCategory(null);
  }

  function handleEditCategory(category: string) {
    setEditingCategory(category);
    setTimeAllocationError("");
    setValidationErrors({});
  }

  function handleCancelEditCategory() {
    setEditingCategory(null);
    setTimeAllocationError("");
    setValidationErrors({});
    // Reset form to current profile values
    if (profile?.timeCategories) {
      setTimeAllocationForm({
        personalWorkStart: profile.timeCategories.personalWork?.startTime || "",
        personalWorkEnd: profile.timeCategories.personalWork?.endTime || "",
        workBlockStart: profile.timeCategories.workBlock?.startTime || "",
        workBlockEnd: profile.timeCategories.workBlock?.endTime || "",
        productiveStart: profile.timeCategories.productive?.startTime || "",
        productiveEnd: profile.timeCategories.productive?.endTime || "",
        familyTimeStart: profile.timeCategories.familyTime?.startTime || "",
        familyTimeEnd: profile.timeCategories.familyTime?.endTime || "",
        journalStart: profile.timeCategories.journaling?.startTime || "",
        journalEnd: profile.timeCategories.journaling?.endTime || "",
      });
    }
  }

  function handleCancelEdit() {
    // Reset form to current profile values
    if (profile?.timeCategories) {
      setTimeAllocationForm({
        personalWorkStart: profile.timeCategories.personalWork?.startTime || "",
        personalWorkEnd: profile.timeCategories.personalWork?.endTime || "",
        workBlockStart: profile.timeCategories.workBlock?.startTime || "",
        workBlockEnd: profile.timeCategories.workBlock?.endTime || "",
        productiveStart: profile.timeCategories.productive?.startTime || "",
        productiveEnd: profile.timeCategories.productive?.endTime || "",
        familyTimeStart: profile.timeCategories.familyTime?.startTime || "",
        familyTimeEnd: profile.timeCategories.familyTime?.endTime || "",
        journalStart: profile.timeCategories.journaling?.startTime || "",
        journalEnd: profile.timeCategories.journaling?.endTime || "",
      });
    }
    setEditingTimeAllocation(false);
    setTimeAllocationError("");
    setValidationErrors({});
  }

  function handleAdjustDuration(
    category: string,
    adjustmentMinutes: number
  ) {
    const limits = TIME_LIMITS[category as keyof typeof TIME_LIMITS];
    if (!limits) return;

    let startKey = `${category}Start` as keyof typeof timeAllocationForm;
    let endKey = `${category}End` as keyof typeof timeAllocationForm;
    
    // Handle journaling category name mismatch
    if (category === "journal") {
      startKey = "journalStart" as keyof typeof timeAllocationForm;
      endKey = "journalEnd" as keyof typeof timeAllocationForm;
    }

    const startTime = timeAllocationForm[startKey] as string;
    const currentEndTime = timeAllocationForm[endKey] as string;

    if (!startTime || !currentEndTime) return;

    const newEndTime = adjustDuration(
      startTime,
      currentEndTime,
      adjustmentMinutes,
      limits.min,
      limits.max
    );

    if (newEndTime) {
      setTimeAllocationForm({
        ...timeAllocationForm,
        [endKey]: newEndTime,
      });
      // Clear validation errors for this category
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`${category}Duration`];
        delete newErrors[`${category}Overlap`];
        return newErrors;
      });
    }
  }

  async function handleProfilePictureChange(base64: string) {
    console.log("[PROFILE PAGE] Profile picture change initiated");
    console.log("[PROFILE PAGE] Base64 length:", base64.length);
    setSavingProfilePicture(true);
    setProfilePictureError("");

    const formData = new FormData();
    formData.append("profilePicture", base64);

    const result = await updateProfilePicture(formData);
    console.log("[PROFILE PAGE] Update result:", result.success);

    if (result.success && result.profile) {
      console.log("[PROFILE PAGE] Profile picture saved successfully");
      console.log("[PROFILE PAGE] Updated profile has picture:", !!result.profile.profilePicture);
      // Update profile state immediately
      setProfile(result.profile);
      // Reload profile to ensure we have the latest data from database
      const reloadResult = await getUserProfile();
      if (reloadResult.success && reloadResult.profile) {
        console.log("[PROFILE PAGE] Profile reloaded after save");
        console.log("[PROFILE PAGE] Reloaded profile has picture:", !!reloadResult.profile.profilePicture);
        setProfile(reloadResult.profile);
      }
    } else {
      console.error("[PROFILE PAGE] Failed to save profile picture:", result.error);
      setProfilePictureError(result.error || "Failed to update profile picture");
      // Reload profile to revert to saved state if update failed
      const reloadResult = await getUserProfile();
      if (reloadResult.success && reloadResult.profile) {
        setProfile(reloadResult.profile);
      }
    }
    setSavingProfilePicture(false);
  }

  async function handleLogout() {
    await logout();
    router.push("/auth/login");
    router.refresh();
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-purple-950/20 dark:to-indigo-950/30 pb-28 sm:pb-24 safe-bottom">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="animate-pulse">
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-32 mb-6"></div>
            <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-32 mb-6"></div>
            <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl mb-4"></div>
            <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded-2xl mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 sm:pb-20 md:pb-6 md:pl-20 lg:pl-64 safe-bottom animate-fade-in">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 mb-6 md:mb-8 tracking-tight">
          Profile
        </h1>

        {/* Profile Picture */}
        {profile && (
          <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 mb-4 animate-scale-in">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 flex flex-col items-center">
              <ProfilePicture
                key={profile.profilePicture || "no-picture"}
                name={profile.name || "User"}
                profilePicture={profile.profilePicture}
                size="xl"
                editable={true}
                onPictureChange={handleProfilePictureChange}
                className="mb-4"
              />
              {profilePictureError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs text-center max-w-xs">
                  {profilePictureError}
                </div>
              )}
              {savingProfilePicture && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Saving...</p>
              )}
            </div>
          </div>
        )}

        {/* Personal Information */}
        {profile && (
          <>
            <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 mb-4 animate-scale-in">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10">
                <h2 className="font-semibold text-xl text-slate-900 dark:text-slate-100 mb-4 sm:mb-6 tracking-tight">Personal Information</h2>
                <div className="space-y-4">
                  {/* Name */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Name</p>
                      <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{profile.name || "Not set"}</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Email</p>
                      <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{profile.email || "Not set"}</p>
                    </div>
                  </div>

                  {/* Date of Birth */}
                  {profile.dateOfBirth && (
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-pink-100 dark:bg-pink-900/30 rounded-xl">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Date of Birth</p>
                        <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                          {format(new Date(profile.dateOfBirth), "MMMM d, yyyy")}
                          {profile.age && ` (${profile.age} years old)`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Profession */}
                  {profile.profession && (
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Profession</p>
                        <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">{profile.profession}</p>
                      </div>
                    </div>
                  )}

                  {/* Pin Code */}
                  {profile.pinCode && (
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                        <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Pin Code</p>
                        <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">{profile.pinCode}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Time Categories */}
            {profile.timeCategories && (
              <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 mb-4 animate-scale-in">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/0 to-orange-400/0 dark:from-amber-400/0 dark:to-orange-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h2 className="font-semibold text-xl text-slate-900 dark:text-slate-100 tracking-tight">Daily Time Allocation</h2>
                  </div>
                  {timeAllocationError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                      {timeAllocationError}
                    </div>
                  )}
                  {timeAllocationWarnings.length > 0 && (
                    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                      <div className="flex items-start gap-2">
                        <div className="text-yellow-600 dark:text-yellow-400 font-semibold text-sm">⚠️ Warning:</div>
                        <div className="flex-1">
                          <p className="text-yellow-800 dark:text-yellow-300 text-sm font-medium mb-2">
                            Some habits are outside the new time range:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-400 text-sm">
                            {timeAllocationWarnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                          <p className="text-yellow-700 dark:text-yellow-400 text-xs mt-2 italic">
                            Please update these habits to fit within the new time range.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {editingTimeAllocation ? (
                    <form onSubmit={handleSaveTimeAllocation} className="space-y-4">
                      {validationErrors.totalTime && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                          {validationErrors.totalTime}
                        </div>
                      )}
                      
                      {/* Personal Work */}
                      {profile.timeCategories.personalWork && (
                        <div className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl ${validationErrors.personalWorkDuration || validationErrors.personalWorkOverlap ? "border-2 border-red-300 dark:border-red-700" : ""}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Personal Work</p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Allowed duration range: <span className="font-semibold text-indigo-600 dark:text-indigo-400">1h 15min to 2h 30min</span> (choose any time within this range)</p>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                              <input
                                type="time"
                                name="personalWorkStart"
                                value={timeAllocationForm.personalWorkStart || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, personalWorkStart: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.personalWorkStart;
                                    delete newErrors.personalWorkDuration;
                                    delete newErrors.personalWorkOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs text-slate-600 dark:text-slate-400">End Time</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("personalWork", -15)}
                                    disabled={!timeAllocationForm.personalWorkStart || !timeAllocationForm.personalWorkEnd}
                                    className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Decrease by 15 minutes"
                                  >
                                    -15
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("personalWork", 15)}
                                    disabled={!timeAllocationForm.personalWorkStart || !timeAllocationForm.personalWorkEnd}
                                    className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Increase by 15 minutes"
                                  >
                                    +15
                                  </button>
                                </div>
                              </div>
                              <input
                                type="time"
                                name="personalWorkEnd"
                                value={timeAllocationForm.personalWorkEnd || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, personalWorkEnd: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.personalWorkEnd;
                                    delete newErrors.personalWorkDuration;
                                    delete newErrors.personalWorkOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                          </div>
                          {timeAllocationForm.personalWorkStart && timeAllocationForm.personalWorkEnd && (() => {
                            const duration = calculateDuration(timeAllocationForm.personalWorkStart, timeAllocationForm.personalWorkEnd);
                            const isValid = duration >= TIME_LIMITS.personalWork.min && duration <= TIME_LIMITS.personalWork.max;
                            return (
                              <p className={`text-xs font-medium ${isValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                Current duration: {Math.floor(duration / 60)}h {duration % 60}min {isValid ? "✓ (within range)" : "✗ (outside range)"}
                              </p>
                            );
                          })()}
                          {validationErrors.personalWorkDuration && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.personalWorkDuration}</p>
                          )}
                          {validationErrors.personalWorkOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.personalWorkOverlap}</p>
                          )}
                        </div>
                      )}

                      {/* Work Block */}
                      {profile.timeCategories.workBlock && (
                        <div className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl ${validationErrors.workBlockDuration || validationErrors.workBlockOverlap ? "border-2 border-red-300 dark:border-red-700" : ""}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Work Block</p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Allowed duration range: <span className="font-semibold text-purple-600 dark:text-purple-400">2h to 4h</span> (choose any time within this range)</p>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                              <input
                                type="time"
                                name="workBlockStart"
                                value={timeAllocationForm.workBlockStart || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, workBlockStart: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.workBlockStart;
                                    delete newErrors.workBlockDuration;
                                    delete newErrors.workBlockOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs text-slate-600 dark:text-slate-400">End Time</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("workBlock", -15)}
                                    disabled={!timeAllocationForm.workBlockStart || !timeAllocationForm.workBlockEnd}
                                    className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Decrease by 15 minutes"
                                  >
                                    -15
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("workBlock", 15)}
                                    disabled={!timeAllocationForm.workBlockStart || !timeAllocationForm.workBlockEnd}
                                    className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Increase by 15 minutes"
                                  >
                                    +15
                                  </button>
                                </div>
                              </div>
                              <input
                                type="time"
                                name="workBlockEnd"
                                value={timeAllocationForm.workBlockEnd || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, workBlockEnd: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.workBlockEnd;
                                    delete newErrors.workBlockDuration;
                                    delete newErrors.workBlockOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                          </div>
                          {timeAllocationForm.workBlockStart && timeAllocationForm.workBlockEnd && (() => {
                            const duration = calculateDuration(timeAllocationForm.workBlockStart, timeAllocationForm.workBlockEnd);
                            const isValid = duration >= TIME_LIMITS.workBlock.min && duration <= TIME_LIMITS.workBlock.max;
                            return (
                              <p className={`text-xs font-medium ${isValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                Current duration: {Math.floor(duration / 60)}h {duration % 60}min {isValid ? "✓ (within range)" : "✗ (outside range)"}
                              </p>
                            );
                          })()}
                          {validationErrors.workBlockDuration && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.workBlockDuration}</p>
                          )}
                          {validationErrors.workBlockOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.workBlockOverlap}</p>
                          )}
                        </div>
                      )}

                      {/* Productive */}
                      {profile.timeCategories.productive && (
                        <div className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl ${validationErrors.productiveDuration || validationErrors.productiveOverlap ? "border-2 border-red-300 dark:border-red-700" : ""}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <Clock className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Productive</p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Allowed duration range: <span className="font-semibold text-green-600 dark:text-green-400">1h 45min to 3h 30min</span> (choose any time within this range)</p>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                              <input
                                type="time"
                                name="productiveStart"
                                value={timeAllocationForm.productiveStart || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, productiveStart: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.productiveStart;
                                    delete newErrors.productiveDuration;
                                    delete newErrors.productiveOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs text-slate-600 dark:text-slate-400">End Time</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("productive", -15)}
                                    disabled={!timeAllocationForm.productiveStart || !timeAllocationForm.productiveEnd}
                                    className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Decrease by 15 minutes"
                                  >
                                    -15
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("productive", 15)}
                                    disabled={!timeAllocationForm.productiveStart || !timeAllocationForm.productiveEnd}
                                    className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Increase by 15 minutes"
                                  >
                                    +15
                                  </button>
                                </div>
                              </div>
                              <input
                                type="time"
                                name="productiveEnd"
                                value={timeAllocationForm.productiveEnd || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, productiveEnd: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.productiveEnd;
                                    delete newErrors.productiveDuration;
                                    delete newErrors.productiveOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                          </div>
                          {timeAllocationForm.productiveStart && timeAllocationForm.productiveEnd && (() => {
                            const duration = calculateDuration(timeAllocationForm.productiveStart, timeAllocationForm.productiveEnd);
                            const isValid = duration >= TIME_LIMITS.productive.min && duration <= TIME_LIMITS.productive.max;
                            return (
                              <p className={`text-xs font-medium ${isValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                Current duration: {Math.floor(duration / 60)}h {duration % 60}min {isValid ? "✓ (within range)" : "✗ (outside range)"}
                              </p>
                            );
                          })()}
                          {validationErrors.productiveDuration && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.productiveDuration}</p>
                          )}
                          {validationErrors.productiveOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.productiveOverlap}</p>
                          )}
                        </div>
                      )}

                      {/* Family Time */}
                      {profile.timeCategories.familyTime && (
                        <div className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl border-2 border-pink-200 dark:border-pink-800 ${validationErrors.familyTimeDuration || validationErrors.familyTimeOverlap ? "border-red-300 dark:border-red-700" : ""}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <Users className="w-5 h-5 text-pink-600 dark:text-pink-400 flex-shrink-0" />
                            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Family Time (Compulsory)</p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Allowed duration range: <span className="font-semibold text-pink-600 dark:text-pink-400">1h to 2h</span> (choose any time within this range)</p>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                              <input
                                type="time"
                                name="familyTimeStart"
                                value={timeAllocationForm.familyTimeStart || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, familyTimeStart: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.familyTimeStart;
                                    delete newErrors.familyTimeDuration;
                                    delete newErrors.familyTimeOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs text-slate-600 dark:text-slate-400">End Time</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("familyTime", -15)}
                                    disabled={!timeAllocationForm.familyTimeStart || !timeAllocationForm.familyTimeEnd}
                                    className="px-2 py-1 text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded hover:bg-pink-200 dark:hover:bg-pink-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Decrease by 15 minutes"
                                  >
                                    -15
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("familyTime", 15)}
                                    disabled={!timeAllocationForm.familyTimeStart || !timeAllocationForm.familyTimeEnd}
                                    className="px-2 py-1 text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded hover:bg-pink-200 dark:hover:bg-pink-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Increase by 15 minutes"
                                  >
                                    +15
                                  </button>
                                </div>
                              </div>
                              <input
                                type="time"
                                name="familyTimeEnd"
                                value={timeAllocationForm.familyTimeEnd || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, familyTimeEnd: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.familyTimeEnd;
                                    delete newErrors.familyTimeDuration;
                                    delete newErrors.familyTimeOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                          </div>
                          {timeAllocationForm.familyTimeStart && timeAllocationForm.familyTimeEnd && (() => {
                            const duration = calculateDuration(timeAllocationForm.familyTimeStart, timeAllocationForm.familyTimeEnd);
                            const isValid = duration >= TIME_LIMITS.familyTime.min && duration <= TIME_LIMITS.familyTime.max;
                            return (
                              <p className={`text-xs font-medium ${isValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                Current duration: {Math.floor(duration / 60)}h {duration % 60}min {isValid ? "✓ (within range)" : "✗ (outside range)"}
                              </p>
                            );
                          })()}
                          {validationErrors.familyTimeDuration && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.familyTimeDuration}</p>
                          )}
                          {validationErrors.familyTimeOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.familyTimeOverlap}</p>
                          )}
                        </div>
                      )}

                      {/* Journaling */}
                      {profile.timeCategories.journaling && (
                        <div className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl ${validationErrors.journalDuration || validationErrors.journalOverlap ? "border-2 border-red-300 dark:border-red-700" : ""}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Journaling</p>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Allowed duration range: <span className="font-semibold text-amber-600 dark:text-amber-400">30min to 1h</span> (choose any time within this range)</p>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                              <input
                                type="time"
                                name="journalStart"
                                value={timeAllocationForm.journalStart || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, journalStart: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.journalStart;
                                    delete newErrors.journalDuration;
                                    delete newErrors.journalOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs text-slate-600 dark:text-slate-400">End Time</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("journal", -15)}
                                    disabled={!timeAllocationForm.journalStart || !timeAllocationForm.journalEnd}
                                    className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Decrease by 15 minutes"
                                  >
                                    -15
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustDuration("journal", 15)}
                                    disabled={!timeAllocationForm.journalStart || !timeAllocationForm.journalEnd}
                                    className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Increase by 15 minutes"
                                  >
                                    +15
                                  </button>
                                </div>
                              </div>
                              <input
                                type="time"
                                name="journalEnd"
                                value={timeAllocationForm.journalEnd || ""}
                                onChange={(e) => {
                                  setTimeAllocationForm({ ...timeAllocationForm, journalEnd: e.target.value });
                                  setValidationErrors((prev) => {
                                    const newErrors = { ...prev };
                                    delete newErrors.journalEnd;
                                    delete newErrors.journalDuration;
                                    delete newErrors.journalOverlap;
                                    return newErrors;
                                  });
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                required
                              />
                            </div>
                          </div>
                          {timeAllocationForm.journalStart && timeAllocationForm.journalEnd && (() => {
                            const duration = calculateDuration(timeAllocationForm.journalStart, timeAllocationForm.journalEnd);
                            const isValid = duration >= TIME_LIMITS.journal.min && duration <= TIME_LIMITS.journal.max;
                            return (
                              <p className={`text-xs font-medium ${isValid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                Current duration: {Math.floor(duration / 60)}h {duration % 60}min {isValid ? "✓ (within range)" : "✗ (outside range)"}
                              </p>
                            );
                          })()}
                          {validationErrors.journalDuration && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.journalDuration}</p>
                          )}
                          {validationErrors.journalOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.journalOverlap}</p>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={savingTimeAllocation}
                          className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm sm:text-base min-h-[44px]"
                        >
                          <Save className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{savingTimeAllocation ? "Saving..." : "Save Changes"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={savingTimeAllocation}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm sm:text-base min-h-[44px]"
                        >
                          <X className="w-4 h-4 flex-shrink-0" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4 sm:space-y-5">
                      {/* Personal Work */}
                      {profile.timeCategories.personalWork && (
                        <div className={`p-5 bg-slate-100 dark:bg-slate-700/50 rounded-xl border-2 transition-all ${
                          editingCategory === "personalWork" ? "border-indigo-400 dark:border-indigo-600" : "border-transparent"
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                              <div>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Personal Work</p>
                                {profile.timeCategories.personalWork.startTime && profile.timeCategories.personalWork.endTime ? (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {formatTime12Hour(profile.timeCategories.personalWork.startTime)} - {formatTime12Hour(profile.timeCategories.personalWork.endTime)} • {profile.timeCategories.personalWork.totalHours?.toFixed(1)} hours
                                  </p>
                                ) : (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {profile.timeCategories.personalWork.totalHours?.toFixed(1)} hours
                                  </p>
                                )}
                              </div>
                            </div>
                            {editingCategory === "personalWork" ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                  onClick={() => handleSaveSingleCategory("personalWork")}
                                  disabled={savingCategory === "personalWork"}
                                  className="px-3 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span className="truncate">{savingCategory === "personalWork" ? "Saving..." : "Save"}</span>
                                </button>
                                <button
                                  onClick={handleCancelEditCategory}
                                  disabled={savingCategory === "personalWork"}
                                  className="px-3 sm:px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditCategory("personalWork")}
                                className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-sm flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                          </div>
                          {editingCategory === "personalWork" && (
                            <div className="mt-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.personalWorkStart || profile.timeCategories.personalWork?.startTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, personalWorkStart: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.personalWorkEnd || profile.timeCategories.personalWork?.endTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, personalWorkEnd: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Work Block */}
                      {profile.timeCategories.workBlock && (
                        <div className={`p-5 bg-slate-100 dark:bg-slate-700/50 rounded-xl border-2 transition-all ${
                          editingCategory === "workBlock" ? "border-purple-400 dark:border-purple-600" : "border-transparent"
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                              <div>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Work Block</p>
                                {profile.timeCategories.workBlock.startTime && profile.timeCategories.workBlock.endTime ? (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {formatTime12Hour(profile.timeCategories.workBlock.startTime)} - {formatTime12Hour(profile.timeCategories.workBlock.endTime)} • {profile.timeCategories.workBlock.totalHours?.toFixed(1)} hours
                                  </p>
                                ) : (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {profile.timeCategories.workBlock.totalHours?.toFixed(1)} hours
                                  </p>
                                )}
                              </div>
                            </div>
                            {editingCategory === "workBlock" ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                  onClick={() => handleSaveSingleCategory("workBlock")}
                                  disabled={savingCategory === "workBlock"}
                                  className="px-3 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span className="truncate">{savingCategory === "workBlock" ? "Saving..." : "Save"}</span>
                                </button>
                                <button
                                  onClick={handleCancelEditCategory}
                                  disabled={savingCategory === "workBlock"}
                                  className="px-3 sm:px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditCategory("workBlock")}
                                className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                          </div>
                          {editingCategory === "workBlock" && (
                            <div className="mt-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.workBlockStart || profile.timeCategories.workBlock?.startTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, workBlockStart: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.workBlockEnd || profile.timeCategories.workBlock?.endTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, workBlockEnd: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Productive */}
                      {profile.timeCategories.productive && (
                        <div className={`p-5 bg-slate-100 dark:bg-slate-700/50 rounded-xl border-2 transition-all ${
                          editingCategory === "productive" ? "border-green-400 dark:border-green-600" : "border-transparent"
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Clock className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <div>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Productive</p>
                                {profile.timeCategories.productive.startTime && profile.timeCategories.productive.endTime ? (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {formatTime12Hour(profile.timeCategories.productive.startTime)} - {formatTime12Hour(profile.timeCategories.productive.endTime)} • {profile.timeCategories.productive.totalHours?.toFixed(1)} hours
                                  </p>
                                ) : (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {profile.timeCategories.productive.totalHours?.toFixed(1)} hours
                                  </p>
                                )}
                              </div>
                            </div>
                            {editingCategory === "productive" ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                  onClick={() => handleSaveSingleCategory("productive")}
                                  disabled={savingCategory === "productive"}
                                  className="px-3 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span className="truncate">{savingCategory === "productive" ? "Saving..." : "Save"}</span>
                                </button>
                                <button
                                  onClick={handleCancelEditCategory}
                                  disabled={savingCategory === "productive"}
                                  className="px-3 sm:px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditCategory("productive")}
                                className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                          </div>
                          {editingCategory === "productive" && (
                            <div className="mt-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.productiveStart || profile.timeCategories.productive?.startTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, productiveStart: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.productiveEnd || profile.timeCategories.productive?.endTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, productiveEnd: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Family Time */}
                      {profile.timeCategories.familyTime && (
                        <div className={`p-5 bg-slate-100 dark:bg-slate-700/50 rounded-xl border-2 transition-all ${
                          editingCategory === "familyTime" ? "border-pink-400 dark:border-pink-600" : "border-pink-200 dark:border-pink-800"
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Users className="w-5 h-5 text-pink-600 dark:text-pink-400 flex-shrink-0" />
                              <div>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Family Time (Compulsory)</p>
                                {profile.timeCategories.familyTime.startTime && profile.timeCategories.familyTime.endTime ? (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {formatTime12Hour(profile.timeCategories.familyTime.startTime)} - {formatTime12Hour(profile.timeCategories.familyTime.endTime)} • {profile.timeCategories.familyTime.totalHours?.toFixed(1)} hours
                                  </p>
                                ) : (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {profile.timeCategories.familyTime.totalHours?.toFixed(1)} hours
                                  </p>
                                )}
                              </div>
                            </div>
                            {editingCategory === "familyTime" ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                  onClick={() => handleSaveSingleCategory("familyTime")}
                                  disabled={savingCategory === "familyTime"}
                                  className="px-3 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span className="truncate">{savingCategory === "familyTime" ? "Saving..." : "Save"}</span>
                                </button>
                                <button
                                  onClick={handleCancelEditCategory}
                                  disabled={savingCategory === "familyTime"}
                                  className="px-3 sm:px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditCategory("familyTime")}
                                className="px-4 py-2 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg font-semibold hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors text-sm flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                          </div>
                          {editingCategory === "familyTime" && (
                            <div className="mt-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.familyTimeStart || profile.timeCategories.familyTime?.startTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, familyTimeStart: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.familyTimeEnd || profile.timeCategories.familyTime?.endTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, familyTimeEnd: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Journaling */}
                      {profile.timeCategories.journaling && (
                        <div className={`p-5 bg-slate-100 dark:bg-slate-700/50 rounded-xl border-2 transition-all ${
                          editingCategory === "journaling" ? "border-amber-400 dark:border-amber-600" : "border-transparent"
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                              <div>
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Journaling</p>
                                {profile.timeCategories.journaling.startTime && profile.timeCategories.journaling.endTime ? (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {formatTime12Hour(profile.timeCategories.journaling.startTime)} - {formatTime12Hour(profile.timeCategories.journaling.endTime)} • {profile.timeCategories.journaling.totalHours?.toFixed(1)} hour{profile.timeCategories.journaling.totalHours !== 1 ? "s" : ""}
                                  </p>
                                ) : (
                                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                    {profile.timeCategories.journaling.totalHours?.toFixed(1)} hour{profile.timeCategories.journaling.totalHours !== 1 ? "s" : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                            {editingCategory === "journaling" ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                  onClick={() => handleSaveSingleCategory("journaling")}
                                  disabled={savingCategory === "journaling"}
                                  className="px-3 sm:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span className="truncate">{savingCategory === "journaling" ? "Saving..." : "Save"}</span>
                                </button>
                                <button
                                  onClick={handleCancelEditCategory}
                                  disabled={savingCategory === "journaling"}
                                  className="px-3 sm:px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs sm:text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                                >
                                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditCategory("journaling")}
                                className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-sm flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                          </div>
                          {editingCategory === "journaling" && (
                            <div className="mt-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.journalStart || profile.timeCategories.journaling?.startTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, journalStart: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                                  <input
                                    type="time"
                                    value={timeAllocationForm.journalEnd || profile.timeCategories.journaling?.endTime || ""}
                                    onChange={(e) => setTimeAllocationForm({ ...timeAllocationForm, journalEnd: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Account Created */}
            {profile.createdAt && (
              <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 mb-4 animate-scale-in">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-400/0 to-slate-400/0 dark:from-slate-400/0 dark:to-slate-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Account created on {format(new Date(profile.createdAt), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Appearance Settings */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 mb-4 animate-scale-in">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg text-slate-900 dark:text-slate-100 mb-1 tracking-tight">Appearance</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Toggle dark mode</p>
            </div>
            <button
              onClick={toggleTheme}
              className="tap-target p-3 sm:p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl active:scale-95 transition-all duration-200 touch-active no-select shadow-premium hover:shadow-premium-lg"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500 dark:text-amber-400 transition-transform duration-200" />
              ) : (
                <Moon className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600 dark:text-indigo-400 transition-transform duration-200" />
              )}
            </button>
          </div>
          </div>
        </div>

        {/* Logout */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 animate-scale-in mb-20 sm:mb-24 md:mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400/20 to-orange-400/20 dark:from-red-400/30 dark:to-orange-400/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
          <button
            onClick={handleLogout}
            className="tap-target w-full flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white rounded-xl font-semibold active:scale-95 transition-all duration-200 touch-active no-select min-h-[52px] shadow-premium hover:shadow-premium-lg hover:from-red-600 hover:to-red-700 dark:hover:from-red-700 dark:hover:to-red-800"
          >
            <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-base sm:text-lg tracking-tight font-bold">Sign Out</span>
          </button>
          </div>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
