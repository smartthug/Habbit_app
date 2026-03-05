"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { getUserProfile, updateTimeAllocation, updateProfilePicture, updateSingleTimeCategory } from "@/app/actions/profile";
import { getTodayJournalCount } from "@/app/actions/journal";
import { LogOut, Moon, Sun, User, Mail, Calendar, Briefcase, MapPin, Clock, Target, BookOpen, Users, Edit2, Save, X, Plus, Minus, Pencil } from "lucide-react";
import Navigation from "@/components/Navigation";
import ProfilePicture from "@/components/ProfilePicture";
import { useTheme } from "@/components/ThemeProvider";
import { format } from "date-fns";


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
  const [editingTimeSlot, setEditingTimeSlot] = useState<{category: string, index: number} | null>(null);
  const [timeAllocationForm, setTimeAllocationForm] = useState<any>({});
  const [savingTimeAllocation, setSavingTimeAllocation] = useState(false);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [savingTimeSlot, setSavingTimeSlot] = useState<{category: string, index: number} | null>(null);
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
            personalWorkRanges: result.profile.timeCategories.personalWork?.ranges || [],
            workBlockRanges: result.profile.timeCategories.workBlock?.ranges || [],
            productiveRanges: result.profile.timeCategories.productive?.ranges || [],
            familyTimeRanges: result.profile.timeCategories.familyTime?.ranges || [],
            journalRanges: result.profile.timeCategories.journaling?.ranges || [],
          });
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, []);


  // Validate there are no overlaps within the same category, across categories, and total time <= 24h
  function validateTimeAllocation(formToValidate?: typeof timeAllocationForm): Record<string, string> {
    const form = formToValidate || timeAllocationForm;
    const errors: Record<string, string> = {};
    const categories: { key: string; name: string; ranges: { startTime: string; endTime: string }[] }[] = [
      { key: "personalWork", name: "Personal", ranges: form.personalWorkRanges || [] },
      { key: "workBlock", name: "Work", ranges: form.workBlockRanges || [] },
      { key: "productive", name: "Productivity", ranges: form.productiveRanges || [] },
      { key: "familyTime", name: "Family", ranges: form.familyTimeRanges || [] },
      { key: "journal", name: "Journal", ranges: form.journalRanges || [] },
    ];

    let totalMinutes = 0;
    const allValidRanges: Array<{ category: string; categoryName: string; range: { startTime: string; endTime: string }; index: number }> = [];

    // First pass: collect all valid ranges and check within-category overlaps
    categories.forEach((category) => {
      const ranges = category.ranges || [];

      ranges.forEach((range, index) => {
        if (!range.startTime || !range.endTime) {
          errors[`${category.key}Range_${index}`] = `${category.name} range ${index + 1} must have both start and end time`;
          return;
        }

        const duration = calculateDuration(range.startTime, range.endTime);
        totalMinutes += duration;
        allValidRanges.push({
          category: category.key,
          categoryName: category.name,
          range,
          index,
        });
      });

      // Prevent overlaps within the same category
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          const r1 = ranges[i];
          const r2 = ranges[j];
          if (r1.startTime && r1.endTime && r2.startTime && r2.endTime) {
            if (timeRangesOverlap(r1.startTime, r1.endTime, r2.startTime, r2.endTime)) {
              errors[`${category.key}Overlap`] = `${category.name} ranges ${i + 1} and ${j + 1} overlap`;
            }
          }
        }
      }
    });

    // Second pass: check for overlaps across different categories
    for (let i = 0; i < allValidRanges.length; i++) {
      for (let j = i + 1; j < allValidRanges.length; j++) {
        const r1 = allValidRanges[i];
        const r2 = allValidRanges[j];
        
        // Only check if they're from different categories
        if (r1.category !== r2.category) {
          if (timeRangesOverlap(r1.range.startTime, r1.range.endTime, r2.range.startTime, r2.range.endTime)) {
            // Create a cross-category overlap error
            const errorKey = `crossOverlap_${r1.category}_${r2.category}`;
            if (!errors[errorKey]) {
              errors[errorKey] = `${r1.categoryName} slot ${r1.index + 1} overlaps with ${r2.categoryName} slot ${r2.index + 1}`;
            }
            // Also mark both categories as having cross-overlaps
            errors[`${r1.category}CrossOverlap`] = `${r1.categoryName} has overlapping time slots with other categories`;
            errors[`${r2.category}CrossOverlap`] = `${r2.categoryName} has overlapping time slots with other categories`;
          }
        }
      }
    }

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

    const formData = new FormData();
    formData.append(
      "timeRanges",
      JSON.stringify({
        personalWork: timeAllocationForm.personalWorkRanges || [],
        workBlock: timeAllocationForm.workBlockRanges || [],
        productive: timeAllocationForm.productiveRanges || [],
        familyTime: timeAllocationForm.familyTimeRanges || [],
        journaling: timeAllocationForm.journalRanges || [],
      })
    );
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
    // For multi-range system, single-category updates go through the main save handler
    setSavingCategory(category);
    setTimeAllocationError("");

    const formData = new FormData();
    formData.append(
      "timeRanges",
      JSON.stringify({
        personalWork: timeAllocationForm.personalWorkRanges || [],
        workBlock: timeAllocationForm.workBlockRanges || [],
        productive: timeAllocationForm.productiveRanges || [],
        familyTime: timeAllocationForm.familyTimeRanges || [],
        journaling: timeAllocationForm.journalRanges || [],
      })
    );

    const result = await updateTimeAllocation(formData);

    if (result.success && result.profile) {
      setProfile(result.profile);
      setEditingCategory(null);
      // Update form with saved values from server
      if (result.profile.timeCategories) {
        setTimeAllocationForm({
          personalWorkRanges: result.profile.timeCategories.personalWork?.ranges || [],
          workBlockRanges: result.profile.timeCategories.workBlock?.ranges || [],
          productiveRanges: result.profile.timeCategories.productive?.ranges || [],
          familyTimeRanges: result.profile.timeCategories.familyTime?.ranges || [],
          journalRanges: result.profile.timeCategories.journaling?.ranges || [],
        });
      }
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
        personalWorkRanges: profile.timeCategories.personalWork?.ranges || [],
        workBlockRanges: profile.timeCategories.workBlock?.ranges || [],
        productiveRanges: profile.timeCategories.productive?.ranges || [],
        familyTimeRanges: profile.timeCategories.familyTime?.ranges || [],
        journalRanges: profile.timeCategories.journaling?.ranges || [],
      });
    }
  }

  function handleCancelEdit() {
    // Reset form to current profile values
    if (profile?.timeCategories) {
      setTimeAllocationForm({
        personalWorkRanges: profile.timeCategories.personalWork?.ranges || [],
        workBlockRanges: profile.timeCategories.workBlock?.ranges || [],
        productiveRanges: profile.timeCategories.productive?.ranges || [],
        familyTimeRanges: profile.timeCategories.familyTime?.ranges || [],
        journalRanges: profile.timeCategories.journaling?.ranges || [],
      });
    }
    setEditingTimeAllocation(false);
    setTimeAllocationError("");
    setValidationErrors({});
  }

  function handleEditTimeSlot(category: string, index: number) {
    // Ensure form is initialized with current profile values
    if (profile?.timeCategories && (!timeAllocationForm.personalWorkRanges && !timeAllocationForm.workBlockRanges)) {
      setTimeAllocationForm({
        personalWorkRanges: profile.timeCategories.personalWork?.ranges || [],
        workBlockRanges: profile.timeCategories.workBlock?.ranges || [],
        productiveRanges: profile.timeCategories.productive?.ranges || [],
        familyTimeRanges: profile.timeCategories.familyTime?.ranges || [],
        journalRanges: profile.timeCategories.journaling?.ranges || [],
      });
    }
    setEditingTimeSlot({ category, index });
    setTimeAllocationError("");
    setValidationErrors({});
  }

  function handleCancelEditTimeSlot() {
    setEditingTimeSlot(null);
    setTimeAllocationError("");
    setValidationErrors({});
    // Reset form to current profile values
    if (profile?.timeCategories) {
      setTimeAllocationForm({
        personalWorkRanges: profile.timeCategories.personalWork?.ranges || [],
        workBlockRanges: profile.timeCategories.workBlock?.ranges || [],
        productiveRanges: profile.timeCategories.productive?.ranges || [],
        familyTimeRanges: profile.timeCategories.familyTime?.ranges || [],
        journalRanges: profile.timeCategories.journaling?.ranges || [],
      });
    }
  }

  async function handleSaveTimeSlot(category: string, index: number) {
    setSavingTimeSlot({ category, index });
    setTimeAllocationError("");

    // Validate the specific time slot
    const categoryKey = category === "journaling" ? "journal" : category;
    // Map category name to form field name (journaling uses journalRanges)
    const formFieldName = category === "journaling" ? "journalRanges" : `${category}Ranges`;
    const ranges = timeAllocationForm[formFieldName] || [];
    const range = ranges[index];

    if (!range || !range.startTime || !range.endTime) {
      setValidationErrors({ [`${categoryKey}Range_${index}`]: "Both start and end time are required" });
      setSavingTimeSlot(null);
      return;
    }

    // Validate overlaps
    const errors = validateTimeAllocation();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSavingTimeSlot(null);
      return;
    }

    const formData = new FormData();
    formData.append(
      "timeRanges",
      JSON.stringify({
        personalWork: timeAllocationForm.personalWorkRanges || [],
        workBlock: timeAllocationForm.workBlockRanges || [],
        productive: timeAllocationForm.productiveRanges || [],
        familyTime: timeAllocationForm.familyTimeRanges || [],
        journaling: timeAllocationForm.journalRanges || [],
      })
    );

    const result = await updateTimeAllocation(formData);

    if (result.success && result.profile) {
      setProfile(result.profile);
      setEditingTimeSlot(null);
      // Update form with saved values from server
      if (result.profile.timeCategories) {
        setTimeAllocationForm({
          personalWorkRanges: result.profile.timeCategories.personalWork?.ranges || [],
          workBlockRanges: result.profile.timeCategories.workBlock?.ranges || [],
          productiveRanges: result.profile.timeCategories.productive?.ranges || [],
          familyTimeRanges: result.profile.timeCategories.familyTime?.ranges || [],
          journalRanges: result.profile.timeCategories.journaling?.ranges || [],
        });
      }
      // Show warnings if any habits are outside the new range
      if (result.warnings && result.warnings.length > 0) {
        setTimeAllocationWarnings(result.warnings);
      } else {
        setTimeAllocationWarnings([]);
      }
      router.refresh();
    } else {
      setTimeAllocationError(result.error || "Failed to update time slot");
      setTimeAllocationWarnings([]);
    }
    setSavingTimeSlot(null);
  }

  // In the new multi-range system we don't auto-adjust durations with fixed limits,
  // so this helper is no longer used but kept for backward compatibility.

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
                    {!editingTimeAllocation && (
                      <button
                        onClick={() => {
                          // Initialize form with current profile values when entering edit mode
                          if (profile?.timeCategories) {
                            // Helper to convert legacy single time slot to ranges format
                            const getRanges = (category: any) => {
                              if (category?.ranges && category.ranges.length > 0) {
                                return category.ranges;
                              } else if (category?.startTime && category?.endTime) {
                                // Convert legacy single time slot to ranges format
                                return [{ startTime: category.startTime, endTime: category.endTime }];
                              }
                              return [{ startTime: "", endTime: "" }];
                            };

                            setTimeAllocationForm({
                              personalWorkRanges: getRanges(profile.timeCategories.personalWork),
                              workBlockRanges: getRanges(profile.timeCategories.workBlock),
                              productiveRanges: getRanges(profile.timeCategories.productive),
                              familyTimeRanges: getRanges(profile.timeCategories.familyTime),
                              journalRanges: getRanges(profile.timeCategories.journaling),
                            });
                          }
                          setEditingTimeAllocation(true);
                          setValidationErrors({});
                        }}
                        className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-sm flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Time Slot
                      </button>
                    )}
                  </div>
                  {timeAllocationError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                      {timeAllocationError}
                    </div>
                  )}
                  {/* Show cross-category overlap errors */}
                  {Object.keys(validationErrors)
                    .filter((key) => key.startsWith("crossOverlap_"))
                    .map((key) => (
                      <div key={key} className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                        {validationErrors[key]}
                      </div>
                    ))}
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

                      {/* Helper to render range editors for each category */}
                      {/* Personal Work */}
                      {profile.timeCategories.personalWork && (
                        <div
                          className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl ${
                            validationErrors.personalWorkOverlap || validationErrors.personalWorkCrossOverlap ? "border-2 border-red-300 dark:border-red-700" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                              <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                                Personal
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentRanges = timeAllocationForm.personalWorkRanges || [];
                                setTimeAllocationForm({
                                  ...timeAllocationForm,
                                  personalWorkRanges: [...currentRanges, { startTime: "", endTime: "" }],
                                });
                              }}
                              className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-xs sm:text-sm flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Time Slot
                            </button>
                          </div>

                          {(timeAllocationForm.personalWorkRanges || []).map(
                            (range: any, index: number) => (
                              <div
                                key={index}
                                className={`mb-3 grid grid-cols-12 gap-2 items-end ${
                                  validationErrors[`personalWorkRange_${index}`]
                                    ? "border border-red-300 dark:border-red-700 rounded-lg p-2"
                                    : ""
                                }`}
                              >
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={range.startTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.personalWorkRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        startTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        personalWorkRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={range.endTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.personalWorkRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        endTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        personalWorkRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (timeAllocationForm.personalWorkRanges || []).filter((_, i) => i !== index);
                                      setTimeAllocationForm({
                                        ...timeAllocationForm,
                                        personalWorkRanges: updated.length > 0 ? updated : [{ startTime: "", endTime: "" }],
                                      });
                                    }}
                                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                    aria-label="Delete time slot"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )
                          )}

                          {validationErrors.personalWorkOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.personalWorkOverlap}
                            </p>
                          )}
                          {validationErrors.personalWorkCrossOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.personalWorkCrossOverlap}
                            </p>
                          )}
                          {/* Show specific cross-overlap messages for personalWork */}
                          {Object.keys(validationErrors)
                            .filter((key) => key.startsWith("crossOverlap_personalWork_") || (key.startsWith("crossOverlap_") && key.includes("_personalWork")))
                            .map((key) => (
                              <p key={key} className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {validationErrors[key]}
                              </p>
                            ))}
                        </div>
                      )}

                      {/* Work Block */}
                      {profile.timeCategories.workBlock && (
                        <div
                          className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl ${
                            validationErrors.workBlockOverlap || validationErrors.workBlockCrossOverlap ? "border-2 border-red-300 dark:border-red-700" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                              <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                                Work
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentRanges = timeAllocationForm.workBlockRanges || [];
                                setTimeAllocationForm({
                                  ...timeAllocationForm,
                                  workBlockRanges: [...currentRanges, { startTime: "", endTime: "" }],
                                });
                              }}
                              className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-xs sm:text-sm flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Time Slot
                            </button>
                          </div>

                          {(timeAllocationForm.workBlockRanges || []).map(
                            (range: any, index: number) => (
                              <div
                                key={index}
                                className={`mb-3 grid grid-cols-12 gap-2 items-end ${
                                  validationErrors[`workBlockRange_${index}`]
                                    ? "border border-red-300 dark:border-red-700 rounded-lg p-2"
                                    : ""
                                }`}
                              >
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={range.startTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.workBlockRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        startTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        workBlockRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={range.endTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.workBlockRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        endTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        workBlockRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (timeAllocationForm.workBlockRanges || []).filter((_, i) => i !== index);
                                      setTimeAllocationForm({
                                        ...timeAllocationForm,
                                        workBlockRanges: updated.length > 0 ? updated : [{ startTime: "", endTime: "" }],
                                      });
                                    }}
                                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                    aria-label="Delete time slot"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )
                          )}

                          {validationErrors.workBlockOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.workBlockOverlap}
                            </p>
                          )}
                          {validationErrors.workBlockCrossOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.workBlockCrossOverlap}
                            </p>
                          )}
                          {/* Show specific cross-overlap messages for workBlock */}
                          {Object.keys(validationErrors)
                            .filter((key) => key.startsWith("crossOverlap_workBlock_") || (key.startsWith("crossOverlap_") && key.includes("_workBlock")))
                            .map((key) => (
                              <p key={key} className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {validationErrors[key]}
                              </p>
                            ))}
                        </div>
                      )}

                      {/* Productive */}
                      {profile.timeCategories.productive && (
                        <div
                          className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl ${
                            validationErrors.productiveOverlap || validationErrors.productiveCrossOverlap ? "border-2 border-red-300 dark:border-red-700" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Clock className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                                Productivity
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentRanges = timeAllocationForm.productiveRanges || [];
                                setTimeAllocationForm({
                                  ...timeAllocationForm,
                                  productiveRanges: [...currentRanges, { startTime: "", endTime: "" }],
                                });
                              }}
                              className="px-3 py-1.5 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg font-semibold hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors text-xs sm:text-sm flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Time Slot
                            </button>
                          </div>

                          {(timeAllocationForm.productiveRanges || []).map(
                            (range: any, index: number) => (
                              <div
                                key={index}
                                className={`mb-3 grid grid-cols-12 gap-2 items-end ${
                                  validationErrors[`productiveRange_${index}`]
                                    ? "border border-red-300 dark:border-red-700 rounded-lg p-2"
                                    : ""
                                }`}
                              >
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={range.startTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.productiveRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        startTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        productiveRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={range.endTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.productiveRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        endTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        productiveRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (timeAllocationForm.productiveRanges || []).filter((_, i) => i !== index);
                                      setTimeAllocationForm({
                                        ...timeAllocationForm,
                                        productiveRanges: updated.length > 0 ? updated : [{ startTime: "", endTime: "" }],
                                      });
                                    }}
                                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                    aria-label="Delete time slot"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )
                          )}

                          {validationErrors.productiveOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.productiveOverlap}
                            </p>
                          )}
                          {validationErrors.productiveCrossOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.productiveCrossOverlap}
                            </p>
                          )}
                          {/* Show specific cross-overlap messages for productive */}
                          {Object.keys(validationErrors)
                            .filter((key) => key.startsWith("crossOverlap_productive_") || (key.startsWith("crossOverlap_") && key.includes("_productive")))
                            .map((key) => (
                              <p key={key} className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {validationErrors[key]}
                              </p>
                            ))}
                        </div>
                      )}

                      {/* Family Time */}
                      {profile.timeCategories.familyTime && (
                        <div
                          className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl border-2 border-pink-200 dark:border-pink-800 ${
                            validationErrors.familyTimeOverlap || validationErrors.familyTimeCrossOverlap ? "border-red-300 dark:border-red-700" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Users className="w-5 h-5 text-pink-600 dark:text-pink-400 flex-shrink-0" />
                              <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                                Family Time
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentRanges = timeAllocationForm.familyTimeRanges || [];
                                setTimeAllocationForm({
                                  ...timeAllocationForm,
                                  familyTimeRanges: [...currentRanges, { startTime: "", endTime: "" }],
                                });
                              }}
                              className="px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg font-semibold hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors text-xs sm:text-sm flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Time Slot
                            </button>
                          </div>

                          {(timeAllocationForm.familyTimeRanges || []).map(
                            (range: any, index: number) => (
                              <div
                                key={index}
                                className={`mb-3 grid grid-cols-12 gap-2 items-end ${
                                  validationErrors[`familyTimeRange_${index}`]
                                    ? "border border-red-300 dark:border-red-700 rounded-lg p-2"
                                    : ""
                                }`}
                              >
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={range.startTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.familyTimeRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        startTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        familyTimeRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={range.endTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.familyTimeRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        endTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        familyTimeRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (timeAllocationForm.familyTimeRanges || []).filter((_, i) => i !== index);
                                      setTimeAllocationForm({
                                        ...timeAllocationForm,
                                        familyTimeRanges: updated.length > 0 ? updated : [{ startTime: "", endTime: "" }],
                                      });
                                    }}
                                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                    aria-label="Delete time slot"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )
                          )}

                          {validationErrors.familyTimeOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.familyTimeOverlap}
                            </p>
                          )}
                          {validationErrors.familyTimeCrossOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.familyTimeCrossOverlap}
                            </p>
                          )}
                          {/* Show specific cross-overlap messages for familyTime */}
                          {Object.keys(validationErrors)
                            .filter((key) => key.startsWith("crossOverlap_familyTime_") || (key.startsWith("crossOverlap_") && key.includes("_familyTime")))
                            .map((key) => (
                              <p key={key} className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {validationErrors[key]}
                              </p>
                            ))}
                        </div>
                      )}

                      {/* Journaling */}
                      {profile.timeCategories.journaling && (
                        <div
                          className={`p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl ${
                            validationErrors.journalOverlap || validationErrors.journalCrossOverlap ? "border-2 border-red-300 dark:border-red-700" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                              <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                                Journal
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentRanges = timeAllocationForm.journalRanges || [];
                                setTimeAllocationForm({
                                  ...timeAllocationForm,
                                  journalRanges: [...currentRanges, { startTime: "", endTime: "" }],
                                });
                              }}
                              className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-xs sm:text-sm flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Time Slot
                            </button>
                          </div>

                          {(timeAllocationForm.journalRanges || []).map(
                            (range: any, index: number) => (
                              <div
                                key={index}
                                className={`mb-3 grid grid-cols-12 gap-2 items-end ${
                                  validationErrors[`journalRange_${index}`]
                                    ? "border border-red-300 dark:border-red-700 rounded-lg p-2"
                                    : ""
                                }`}
                              >
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={range.startTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.journalRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        startTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        journalRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-5">
                                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={range.endTime || ""}
                                    onChange={(e) => {
                                      const updated = [...(timeAllocationForm.journalRanges || [])];
                                      updated[index] = {
                                        ...updated[index],
                                        endTime: e.target.value,
                                      };
                                      const newForm = {
                                        ...timeAllocationForm,
                                        journalRanges: updated,
                                      };
                                      setTimeAllocationForm(newForm);
                                      // Validate in real-time
                                      setTimeout(() => validateTimeAllocation(newForm), 0);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 text-sm"
                                  />
                                </div>
                                <div className="col-span-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (timeAllocationForm.journalRanges || []).filter((_, i) => i !== index);
                                      setTimeAllocationForm({
                                        ...timeAllocationForm,
                                        journalRanges: updated.length > 0 ? updated : [{ startTime: "", endTime: "" }],
                                      });
                                    }}
                                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                    aria-label="Delete time slot"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )
                          )}

                          {validationErrors.journalOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.journalOverlap}
                            </p>
                          )}
                          {validationErrors.journalCrossOverlap && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {validationErrors.journalCrossOverlap}
                            </p>
                          )}
                          {/* Show specific cross-overlap messages for journal */}
                          {Object.keys(validationErrors)
                            .filter((key) => key.startsWith("crossOverlap_journal_") || (key.startsWith("crossOverlap_") && key.includes("_journal")))
                            .map((key) => (
                              <p key={key} className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {validationErrors[key]}
                              </p>
                            ))}
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
                                {(profile.timeCategories.personalWork.ranges && profile.timeCategories.personalWork.ranges.length > 0) ? (
                                  <div className="space-y-2">
                                    {profile.timeCategories.personalWork.ranges.map((range: any, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between gap-2">
                                        {editingTimeSlot?.category === "personalWork" && editingTimeSlot?.index === idx ? (
                                          <div className="flex items-center gap-2 flex-1">
                                            <input
                                              type="time"
                                              value={timeAllocationForm.personalWorkRanges?.[idx]?.startTime || range.startTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.personalWorkRanges || profile.timeCategories.personalWork.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  startTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  personalWorkRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">-</span>
                                            <input
                                              type="time"
                                              value={timeAllocationForm.personalWorkRanges?.[idx]?.endTime || range.endTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.personalWorkRanges || profile.timeCategories.personalWork.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  endTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  personalWorkRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <button
                                              onClick={() => handleSaveTimeSlot("personalWork", idx)}
                                              disabled={savingTimeSlot?.category === "personalWork" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
                                              aria-label="Save time slot"
                                            >
                                              <Save className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={handleCancelEditTimeSlot}
                                              disabled={savingTimeSlot?.category === "personalWork" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
                                              aria-label="Cancel editing"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex-1">
                                        {formatTime12Hour(range.startTime)} - {formatTime12Hour(range.endTime)}
                                      </p>
                                            <button
                                              onClick={() => handleEditTimeSlot("personalWork", idx)}
                                              className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors"
                                              aria-label="Edit time slot"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 font-medium">
                                      Total: {profile.timeCategories.personalWork.totalHours?.toFixed(1)} hours
                                    </p>
                                  </div>
                                ) : profile.timeCategories.personalWork.startTime && profile.timeCategories.personalWork.endTime ? (
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
                              </div>
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
                                {(profile.timeCategories.workBlock.ranges && profile.timeCategories.workBlock.ranges.length > 0) ? (
                                  <div className="space-y-2">
                                    {profile.timeCategories.workBlock.ranges.map((range: any, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between gap-2">
                                        {editingTimeSlot?.category === "workBlock" && editingTimeSlot?.index === idx ? (
                                          <div className="flex items-center gap-2 flex-1">
                                            <input
                                              type="time"
                                              value={timeAllocationForm.workBlockRanges?.[idx]?.startTime || range.startTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.workBlockRanges || profile.timeCategories.workBlock.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  startTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  workBlockRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">-</span>
                                            <input
                                              type="time"
                                              value={timeAllocationForm.workBlockRanges?.[idx]?.endTime || range.endTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.workBlockRanges || profile.timeCategories.workBlock.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  endTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  workBlockRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <button
                                              onClick={() => handleSaveTimeSlot("workBlock", idx)}
                                              disabled={savingTimeSlot?.category === "workBlock" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
                                              aria-label="Save time slot"
                                            >
                                              <Save className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={handleCancelEditTimeSlot}
                                              disabled={savingTimeSlot?.category === "workBlock" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
                                              aria-label="Cancel editing"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex-1">
                                        {formatTime12Hour(range.startTime)} - {formatTime12Hour(range.endTime)}
                                      </p>
                                            <button
                                              onClick={() => handleEditTimeSlot("workBlock", idx)}
                                              className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors"
                                              aria-label="Edit time slot"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 font-medium">
                                      Total: {profile.timeCategories.workBlock.totalHours?.toFixed(1)} hours
                                    </p>
                                  </div>
                                ) : profile.timeCategories.workBlock.startTime && profile.timeCategories.workBlock.endTime ? (
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
                              </div>
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
                                {(profile.timeCategories.productive.ranges && profile.timeCategories.productive.ranges.length > 0) ? (
                                  <div className="space-y-2">
                                    {profile.timeCategories.productive.ranges.map((range: any, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between gap-2">
                                        {editingTimeSlot?.category === "productive" && editingTimeSlot?.index === idx ? (
                                          <div className="flex items-center gap-2 flex-1">
                                            <input
                                              type="time"
                                              value={timeAllocationForm.productiveRanges?.[idx]?.startTime || range.startTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.productiveRanges || profile.timeCategories.productive.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  startTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  productiveRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">-</span>
                                            <input
                                              type="time"
                                              value={timeAllocationForm.productiveRanges?.[idx]?.endTime || range.endTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.productiveRanges || profile.timeCategories.productive.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  endTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  productiveRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <button
                                              onClick={() => handleSaveTimeSlot("productive", idx)}
                                              disabled={savingTimeSlot?.category === "productive" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
                                              aria-label="Save time slot"
                                            >
                                              <Save className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={handleCancelEditTimeSlot}
                                              disabled={savingTimeSlot?.category === "productive" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
                                              aria-label="Cancel editing"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex-1">
                                        {formatTime12Hour(range.startTime)} - {formatTime12Hour(range.endTime)}
                                      </p>
                                            <button
                                              onClick={() => handleEditTimeSlot("productive", idx)}
                                              className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                                              aria-label="Edit time slot"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 font-medium">
                                      Total: {profile.timeCategories.productive.totalHours?.toFixed(1)} hours
                                    </p>
                                  </div>
                                ) : profile.timeCategories.productive.startTime && profile.timeCategories.productive.endTime ? (
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
                              </div>
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
                                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">Family Time</p>
                                {(profile.timeCategories.familyTime.ranges && profile.timeCategories.familyTime.ranges.length > 0) ? (
                                  <div className="space-y-2">
                                    {profile.timeCategories.familyTime.ranges.map((range: any, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between gap-2">
                                        {editingTimeSlot?.category === "familyTime" && editingTimeSlot?.index === idx ? (
                                          <div className="flex items-center gap-2 flex-1">
                                            <input
                                              type="time"
                                              value={timeAllocationForm.familyTimeRanges?.[idx]?.startTime || range.startTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.familyTimeRanges || profile.timeCategories.familyTime.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  startTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  familyTimeRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">-</span>
                                            <input
                                              type="time"
                                              value={timeAllocationForm.familyTimeRanges?.[idx]?.endTime || range.endTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.familyTimeRanges || profile.timeCategories.familyTime.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  endTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  familyTimeRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <button
                                              onClick={() => handleSaveTimeSlot("familyTime", idx)}
                                              disabled={savingTimeSlot?.category === "familyTime" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
                                              aria-label="Save time slot"
                                            >
                                              <Save className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={handleCancelEditTimeSlot}
                                              disabled={savingTimeSlot?.category === "familyTime" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
                                              aria-label="Cancel editing"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex-1">
                                        {formatTime12Hour(range.startTime)} - {formatTime12Hour(range.endTime)}
                                      </p>
                                            <button
                                              onClick={() => handleEditTimeSlot("familyTime", idx)}
                                              className="p-1 rounded hover:bg-pink-100 dark:hover:bg-pink-900/30 text-pink-600 dark:text-pink-400 transition-colors"
                                              aria-label="Edit time slot"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 font-medium">
                                      Total: {profile.timeCategories.familyTime.totalHours?.toFixed(1)} hours
                                    </p>
                                  </div>
                                ) : profile.timeCategories.familyTime.startTime && profile.timeCategories.familyTime.endTime ? (
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
                              </div>
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
                                {(profile.timeCategories.journaling.ranges && profile.timeCategories.journaling.ranges.length > 0) ? (
                                  <div className="space-y-2">
                                    {profile.timeCategories.journaling.ranges.map((range: any, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between gap-2">
                                        {editingTimeSlot?.category === "journaling" && editingTimeSlot?.index === idx ? (
                                          <div className="flex items-center gap-2 flex-1">
                                            <input
                                              type="time"
                                              value={timeAllocationForm.journalRanges?.[idx]?.startTime || range.startTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.journalRanges || profile.timeCategories.journaling.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  startTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  journalRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <span className="text-xs text-slate-600 dark:text-slate-400">-</span>
                                            <input
                                              type="time"
                                              value={timeAllocationForm.journalRanges?.[idx]?.endTime || range.endTime || ""}
                                              onChange={(e) => {
                                                const updated = [...(timeAllocationForm.journalRanges || profile.timeCategories.journaling.ranges || [])];
                                                updated[idx] = {
                                                  ...updated[idx],
                                                  endTime: e.target.value,
                                                };
                                                setTimeAllocationForm({
                                                  ...timeAllocationForm,
                                                  journalRanges: updated,
                                                });
                                              }}
                                              className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-slate-100"
                                            />
                                            <button
                                              onClick={() => handleSaveTimeSlot("journaling", idx)}
                                              disabled={savingTimeSlot?.category === "journaling" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 transition-colors"
                                              aria-label="Save time slot"
                                            >
                                              <Save className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={handleCancelEditTimeSlot}
                                              disabled={savingTimeSlot?.category === "journaling" && savingTimeSlot?.index === idx}
                                              className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
                                              aria-label="Cancel editing"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex-1">
                                        {formatTime12Hour(range.startTime)} - {formatTime12Hour(range.endTime)}
                                      </p>
                                            <button
                                              onClick={() => handleEditTimeSlot("journaling", idx)}
                                              className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors"
                                              aria-label="Edit time slot"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 font-medium">
                                      Total: {profile.timeCategories.journaling.totalHours?.toFixed(1)} hour{profile.timeCategories.journaling.totalHours !== 1 ? "s" : ""}
                                    </p>
                                  </div>
                                ) : profile.timeCategories.journaling.startTime && profile.timeCategories.journaling.endTime ? (
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
                              </div>
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
