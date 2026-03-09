"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveProfileSetup, checkProfileSetup } from "@/app/actions/profile";
import { User, Calendar, Briefcase, MapPin, Info, Clock, BookOpen, Users, Target, Zap, Sparkles, CheckCircle2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

// Helper function to convert time string (HH:MM) to minutes
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper function to convert minutes to time string (HH:MM)
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
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
  
  // Handle wrap-around (e.g., 23:00 to 01:00)
  // If end < start, the range wraps around midnight
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

export default function ProfileSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [currentStep, setCurrentStep] = useState<"personal" | "time">("time");
  const [formData, setFormData] = useState({
    name: "",
    dateOfBirth: "",
    profession: "",
    pinCode: "",
  });
  const [timeRanges, setTimeRanges] = useState<{
    personalWork: { startTime: string; endTime: string }[];
    workBlock: { startTime: string; endTime: string }[];
    productive: { startTime: string; endTime: string }[];
    familyTime: { startTime: string; endTime: string }[];
    journal: { startTime: string; endTime: string }[];
  }>({
    personalWork: [{ startTime: "", endTime: "" }],
    workBlock: [{ startTime: "", endTime: "" }],
    productive: [{ startTime: "", endTime: "" }],
    familyTime: [{ startTime: "", endTime: "" }],
    journal: [{ startTime: "", endTime: "" }],
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function checkSetup() {
      const result = await checkProfileSetup();
      if (result.success && result.completed) {
        router.push("/dashboard");
      } else {
        setChecking(false);
      }
    }
    checkSetup();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-purple-950/20 dark:to-indigo-950/30">
        <div className="animate-pulse text-slate-400 dark:text-slate-500">Loading...</div>
      </div>
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear validation error for this field (if any personal-info related)
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }

  function validateTimeAllocation(rangesToValidate?: typeof timeRanges): Record<string, string> {
    const errors: Record<string, string> = {};
    const rangesToCheck = rangesToValidate || timeRanges;
    const categories: { key: keyof typeof timeRanges; name: string }[] = [
      { key: "personalWork", name: "Personal" },
      { key: "workBlock", name: "Work" },
      { key: "productive", name: "Productivity" },
      { key: "familyTime", name: "Family" },
      { key: "journal", name: "Journal" },
    ];

    let totalMinutes = 0;
    const allValidRanges: Array<{ category: string; categoryName: string; range: { startTime: string; endTime: string }; index: number }> = [];

    // First pass: collect all valid ranges and check within-category overlaps
    categories.forEach((category) => {
      const ranges = rangesToCheck[category.key] || [];
      const validRanges = ranges.filter((r) => r.startTime && r.endTime);
      
      // Only show error if this category has NO valid ranges
      if (validRanges.length === 0) {
        errors[`${category.key}Empty`] = `${category.name} must have at least one time slot`;
      } else {
        // Category has valid ranges, so calculate total and check for overlaps
        validRanges.forEach((range, idx) => {
          totalMinutes += calculateDuration(range.startTime, range.endTime);
          allValidRanges.push({
            category: category.key,
            categoryName: category.name,
            range,
            index: ranges.findIndex((r) => r === range),
          });
        });

        // Prevent overlaps within the same category (only check valid ranges)
        for (let i = 0; i < validRanges.length; i++) {
          for (let j = i + 1; j < validRanges.length; j++) {
            const r1 = validRanges[i];
            const r2 = validRanges[j];
            if (timeRangesOverlap(r1.startTime, r1.endTime, r2.startTime, r2.endTime)) {
              // Find the original indices in the full ranges array
              const origIndex1 = ranges.findIndex((r) => r === r1);
              const origIndex2 = ranges.findIndex((r) => r === r2);
              errors[`${category.key}Overlap`] = `${category.name} slots ${origIndex1 + 1} and ${origIndex2 + 1} overlap`;
              break; // Only show one overlap error per category
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

  function calculateAge(dateString: string): number | null {
    if (!dateString) return null;
    const dob = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }

  function canProceedToTimeAllocation(): boolean {
    return !!(formData.name && formData.dateOfBirth && formData.profession && formData.pinCode);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Clear previous validation errors first
    setValidationErrors({});

    // Validate time allocation - only show errors for invalid fields
    const errors = validateTimeAllocation();
    if (Object.keys(errors).length > 0) {
      // Only show generic error if there are actual validation issues
      // Individual field errors will be shown in their respective sections
      setLoading(false);
      return;
    }

    const data = new FormData(e.currentTarget);

    // Attach full time ranges payload
    data.set(
      "timeRanges",
      JSON.stringify({
        personalWork: timeRanges.personalWork,
        workBlock: timeRanges.workBlock,
        productive: timeRanges.productive,
        familyTime: timeRanges.familyTime,
        // Use `journal` to match server-side setup validation,
        // and also send `journaling` for consistency with the stored schema.
        journal: timeRanges.journal,
        journaling: timeRanges.journal,
      })
    );
    const result = await saveProfileSetup(data);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  const age = calculateAge(formData.dateOfBirth);
  const maxDate = new Date().toISOString().split("T")[0];
  const isPersonalInfoComplete = canProceedToTimeAllocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-purple-950/20 dark:to-indigo-950/30 pb-8 sm:pb-10 safe-bottom overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 lg:pt-12 min-w-0">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-10 lg:mb-12 px-1">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 mb-3 sm:mb-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
            <Sparkles className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-2 sm:mb-4 break-words">
            Complete Your Profile
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-0 break-words">
            Let's set up your profile to personalize your experience and optimize your daily schedule
          </p>
        </div>


        {/* Form */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-4 sm:p-8 lg:p-10 min-w-0 overflow-hidden">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Personal Information Section */}
            <div className="transition-all duration-500">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Personal Information
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
                  Tell us a bit about yourself
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-w-0">
                {/* Name */}
                <div className="md:col-span-2 min-w-0">
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Full Name
                  </label>
                  <div className="relative min-w-0">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="block w-full min-w-0 pl-11 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                {/* Date of Birth */}
                <div className="min-w-0">
                  <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Date of Birth
                  </label>
                  <div className="relative min-w-0">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    </div>
                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      max={maxDate}
                      required
                      className="block w-full min-w-0 pl-11 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  {age !== null && (
                    <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                      Age: {age} years
                    </p>
                  )}
                </div>

                {/* Profession */}
                <div className="min-w-0">
                  <label htmlFor="profession" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Profession
                  </label>
                  <div className="relative min-w-0">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <Briefcase className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    </div>
                    <select
                      id="profession"
                      name="profession"
                      value={formData.profession}
                      onChange={handleChange}
                      required
                      className="block w-full min-w-0 pl-11 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select your profession</option>
                      <option value="Student">Student</option>
                      <option value="Housewife">Housewife</option>
                      <option value="Employee">Employee</option>
                      <option value="Business Owner">Business Owner</option>
                      <option value="Freelancer">Freelancer</option>
                      <option value="Retired">Retired</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Pin Code */}
                <div className="md:col-span-2 min-w-0">
                  <label htmlFor="pinCode" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>Pin Code</span>
                      <div className="group relative inline-flex">
                        <Info className="h-4 w-4 text-slate-400 cursor-help flex-shrink-0" />
                        <div className="absolute bottom-full left-0 sm:left-1/2 sm:-translate-x-1/2 mb-2 w-56 max-w-[calc(100vw-2rem)] p-3 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                          This helps connect you with people in your area who share similar interests
                        </div>
                      </div>
                    </div>
                  </label>
                  <div className="relative min-w-0">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    </div>
                    <input
                      id="pinCode"
                      name="pinCode"
                      type="text"
                      value={formData.pinCode}
                      onChange={handleChange}
                      required
                      maxLength={10}
                      className="block w-full min-w-0 pl-11 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="Enter your pin code"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Time Allocation Section */}
            <div className="transition-all duration-500">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Daily Time Allocation
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
                  Set your preferred time blocks for different activities. You can create multiple time slots for each category.
                </p>
              </div>

              {validationErrors.totalTime && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 dark:text-red-400 text-sm">{validationErrors.totalTime}</p>
                </div>
              )}
              {/* Show cross-category overlap errors */}
              {Object.keys(validationErrors)
                .filter((key) => key.startsWith("crossOverlap_"))
                .map((key) => (
                  <div key={key} className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 dark:text-red-400 text-sm">{validationErrors[key]}</p>
                  </div>
                ))}

              <div className="space-y-6 sm:space-y-8">
                {/* Helper to render a category block with multiple slots */}
                {/* Personal */}
                <CategoryTimeSlots
                  id="personalWork"
                  label="Personal"
                  icon={<Target className="w-5 h-5" />}
                  color="indigo"
                  ranges={timeRanges.personalWork}
                  validationErrors={validationErrors}
                  onChange={(ranges) => {
                    const updated = { ...timeRanges, personalWork: ranges };
                    setTimeRanges(updated);
                    // Validate in real-time
                    validateTimeAllocation(updated);
                  }}
                />

                {/* Work */}
                <CategoryTimeSlots
                  id="workBlock"
                  label="Work"
                  icon={<Briefcase className="w-5 h-5" />}
                  color="purple"
                  ranges={timeRanges.workBlock}
                  validationErrors={validationErrors}
                  onChange={(ranges) => {
                    const updated = { ...timeRanges, workBlock: ranges };
                    setTimeRanges(updated);
                    // Validate in real-time
                    validateTimeAllocation(updated);
                  }}
                />

                {/* Productivity */}
                <CategoryTimeSlots
                  id="productive"
                  label="Productivity"
                  icon={<Zap className="w-5 h-5" />}
                  color="teal"
                  ranges={timeRanges.productive}
                  validationErrors={validationErrors}
                  onChange={(ranges) => {
                    const updated = { ...timeRanges, productive: ranges };
                    setTimeRanges(updated);
                    // Validate in real-time
                    validateTimeAllocation(updated);
                  }}
                />

                {/* Family */}
                <CategoryTimeSlots
                  id="familyTime"
                  label="Family"
                  icon={<Users className="w-5 h-5" />}
                  color="orange"
                  ranges={timeRanges.familyTime}
                  validationErrors={validationErrors}
                  onChange={(ranges) => {
                    const updated = { ...timeRanges, familyTime: ranges };
                    setTimeRanges(updated);
                    // Validate in real-time
                    validateTimeAllocation(updated);
                  }}
                />

                {/* Journal */}
                <CategoryTimeSlots
                  id="journal"
                  label="Journal"
                  icon={<BookOpen className="w-5 h-5" />}
                  color="amber"
                  ranges={timeRanges.journal}
                  validationErrors={validationErrors}
                  onChange={(ranges) => {
                    const updated = { ...timeRanges, journal: ranges };
                    setTimeRanges(updated);
                    // Validate in real-time
                    validateTimeAllocation(updated);
                  }}
                />
              </div>

              {/* Submit Button */}
              <div className="mt-6 sm:mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3.5 min-h-[48px] sm:min-h-0 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:via-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 min-w-0 sm:min-w-[200px]"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Setting up...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Complete Setup</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Hidden inputs for form submission */}
            <input
              type="hidden"
              name="personalWorkStart"
              value={timeRanges.personalWork[0]?.startTime || ""}
            />
            <input
              type="hidden"
              name="personalWorkEnd"
              value={timeRanges.personalWork[0]?.endTime || ""}
            />
            <input
              type="hidden"
              name="workBlockStart"
              value={timeRanges.workBlock[0]?.startTime || ""}
            />
            <input
              type="hidden"
              name="workBlockEnd"
              value={timeRanges.workBlock[0]?.endTime || ""}
            />
            <input
              type="hidden"
              name="productiveStart"
              value={timeRanges.productive[0]?.startTime || ""}
            />
            <input
              type="hidden"
              name="productiveEnd"
              value={timeRanges.productive[0]?.endTime || ""}
            />
            <input
              type="hidden"
              name="familyTimeStart"
              value={timeRanges.familyTime[0]?.startTime || ""}
            />
            <input
              type="hidden"
              name="familyTimeEnd"
              value={timeRanges.familyTime[0]?.endTime || ""}
            />
            <input
              type="hidden"
              name="journalStart"
              value={timeRanges.journal[0]?.startTime || ""}
            />
            <input
              type="hidden"
              name="journalEnd"
              value={timeRanges.journal[0]?.endTime || ""}
            />
            <input
              type="hidden"
              name="timeRanges"
              value={JSON.stringify({
                personalWork: timeRanges.personalWork,
                workBlock: timeRanges.workBlock,
                productive: timeRanges.productive,
                familyTime: timeRanges.familyTime,
                journaling: timeRanges.journal,
              })}
            />
          </form>
        </div>
      </div>
    </div>
  );
}

interface CategoryTimeSlotsProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: "indigo" | "purple" | "teal" | "orange" | "amber";
  ranges: { startTime: string; endTime: string }[];
  validationErrors: Record<string, string>;
  onChange: (ranges: { startTime: string; endTime: string }[]) => void;
}

function CategoryTimeSlots({
  id,
  label,
  icon,
  color,
  ranges,
  validationErrors,
  onChange,
}: CategoryTimeSlotsProps) {
  const colorClasses: Record<string, { bg: string; pill: string }> = {
    indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/10", pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
    purple: { bg: "bg-purple-50 dark:bg-purple-900/10", pill: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    teal: { bg: "bg-teal-50 dark:bg-teal-900/10", pill: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
    orange: { bg: "bg-orange-50 dark:bg-orange-900/10", pill: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    amber: { bg: "bg-amber-50 dark:bg-amber-900/10", pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  };

  const hasOverlapError = !!validationErrors[`${id}Overlap`];
  const hasCrossOverlapError = !!validationErrors[`${id}CrossOverlap`];

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border min-w-0 ${
        hasOverlapError || hasCrossOverlapError ? "border-red-300 dark:border-red-700" : "border-slate-200/70 dark:border-slate-700/60"
      } ${colorClasses[color].bg}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 shadow-sm flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Add one or more time slots for this category</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange([...ranges, { startTime: "", endTime: "" }])}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all min-h-[44px] sm:min-h-0 flex-shrink-0 ${colorClasses[color].pill}`}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Time Slot
        </button>
      </div>

      <div className="space-y-3 sm:space-y-2">
        {ranges.map((range, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-2 sm:items-end p-3 sm:p-2 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/60 min-w-0"
          >
            <div className="sm:col-span-5 min-w-0">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Start Time (Slot {index + 1})
              </label>
              <input
                type="time"
                value={range.startTime}
                onChange={(e) => {
                  const updated = [...ranges];
                  updated[index] = { ...updated[index], startTime: e.target.value };
                  onChange(updated);
                }}
                className="w-full min-w-0 px-3 py-2.5 sm:py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="sm:col-span-5 min-w-0">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">End Time</label>
              <input
                type="time"
                value={range.endTime}
                onChange={(e) => {
                  const updated = [...ranges];
                  updated[index] = { ...updated[index], endTime: e.target.value };
                  onChange(updated);
                }}
                className="w-full min-w-0 px-3 py-2.5 sm:py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <button
                type="button"
                onClick={() => {
                  const updated = ranges.filter((_, i) => i !== index);
                  onChange(updated.length ? updated : [{ startTime: "", endTime: "" }]);
                }}
                className="p-2.5 sm:p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                aria-label="Delete time slot"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {validationErrors[`${id}Empty`] && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
          {validationErrors[`${id}Empty`]}
        </p>
      )}
      {validationErrors[`${id}Overlap`] && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
          {validationErrors[`${id}Overlap`]}
        </p>
      )}
      {validationErrors[`${id}CrossOverlap`] && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
          {validationErrors[`${id}CrossOverlap`]}
        </p>
      )}
      {/* Show specific cross-overlap messages */}
      {Object.keys(validationErrors)
        .filter((key) => key.startsWith(`crossOverlap_${id}_`) || key.startsWith(`crossOverlap_`) && key.includes(`_${id}`))
        .map((key) => (
          <p key={key} className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
            {validationErrors[key]}
          </p>
        ))}
    </div>
  );
}
