"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveProfileSetup, checkProfileSetup } from "@/app/actions/profile";
import { User, Calendar, Briefcase, MapPin, Info, Clock, BookOpen, Users, Target, Zap, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import TimeBlockCard from "@/components/TimeBlockCard";
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
    // Personal Work
    personalWorkStart: "",
    personalWorkEnd: "",
    // Work Block
    workBlockStart: "",
    workBlockEnd: "",
    // Productive
    productiveStart: "",
    productiveEnd: "",
    // Family Time
    familyTimeStart: "",
    familyTimeEnd: "",
    // Journal
    journalStart: "",
    journalEnd: "",
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
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    // Validate on change
    validateTimeAllocation();
  }

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
        start: formData.personalWorkStart,
        end: formData.personalWorkEnd,
        limits: TIME_LIMITS.personalWork,
      },
      {
        key: "workBlock",
        name: "Work Block",
        start: formData.workBlockStart,
        end: formData.workBlockEnd,
        limits: TIME_LIMITS.workBlock,
      },
      {
        key: "productive",
        name: "Productive",
        start: formData.productiveStart,
        end: formData.productiveEnd,
        limits: TIME_LIMITS.productive,
      },
      {
        key: "familyTime",
        name: "Family Time",
        start: formData.familyTimeStart,
        end: formData.familyTimeEnd,
        limits: TIME_LIMITS.familyTime,
      },
      {
        key: "journal",
        name: "Journal",
        start: formData.journalStart,
        end: formData.journalEnd,
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

    // Validate time allocation
    const errors = validateTimeAllocation();
    if (Object.keys(errors).length > 0) {
      setError("Please fix the validation errors before submitting.");
      setLoading(false);
      return;
    }

    const data = new FormData(e.currentTarget);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-purple-950/20 dark:to-indigo-950/30 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 lg:pt-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
            <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-3 sm:mb-4">
            Complete Your Profile
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
            Let's set up your profile to personalize your experience and optimize your daily schedule
          </p>
        </div>


        {/* Form */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 sm:p-8 lg:p-10">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {/* Name */}
                <div className="md:col-span-2">
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="block w-full pl-12 pr-4 py-3.5 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                {/* Date of Birth */}
                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      max={maxDate}
                      required
                      className="block w-full pl-12 pr-4 py-3.5 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  {age !== null && (
                    <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                      Age: {age} years
                    </p>
                  )}
                </div>

                {/* Profession */}
                <div>
                  <label htmlFor="profession" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Profession
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Briefcase className="h-5 w-5 text-slate-400" />
                    </div>
                    <select
                      id="profession"
                      name="profession"
                      value={formData.profession}
                      onChange={handleChange}
                      required
                      className="block w-full pl-12 pr-4 py-3.5 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
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
                <div className="md:col-span-2">
                  <label htmlFor="pinCode" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    <div className="flex items-center gap-2">
                      <span>Pin Code</span>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                          This helps connect you with people in your area who share similar interests
                        </div>
                      </div>
                    </div>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="pinCode"
                      name="pinCode"
                      type="text"
                      value={formData.pinCode}
                      onChange={handleChange}
                      required
                      maxLength={10}
                      className="block w-full pl-12 pr-4 py-3.5 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
                  Set your preferred time blocks for different activities. Each category has minimum and maximum duration limits.
                </p>
              </div>

              {validationErrors.totalTime && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 dark:text-red-400 text-sm">{validationErrors.totalTime}</p>
                </div>
              )}

              <div className="space-y-6 sm:space-y-8">
                {/* Personal Work */}
                <TimeBlockCard
                  id="personalWork"
                  title="Personal Work"
                  icon={<Target className="w-5 h-5" />}
                  color={{
                    bg: "bg-blue-50",
                    bgDark: "dark:bg-blue-900/20",
                    border: "border-blue-200",
                    borderDark: "dark:border-blue-800",
                    text: "text-blue-700",
                    textDark: "dark:text-blue-300",
                    icon: "text-blue-600",
                    iconDark: "dark:text-blue-400",
                  }}
                  startTime={formData.personalWorkStart}
                  endTime={formData.personalWorkEnd}
                  minDuration={TIME_LIMITS.personalWork.min}
                  maxDuration={TIME_LIMITS.personalWork.max}
                  onStartTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, personalWorkStart: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.personalWorkStart;
                      delete newErrors.personalWorkDuration;
                      delete newErrors.personalWorkOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  onEndTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, personalWorkEnd: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.personalWorkEnd;
                      delete newErrors.personalWorkDuration;
                      delete newErrors.personalWorkOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  error={
                    validationErrors.personalWorkDuration ||
                    validationErrors.personalWorkOverlap ||
                    undefined
                  }
                  isEditing={true}
                />

                {/* Work Block */}
                <TimeBlockCard
                  id="workBlock"
                  title="Work Block"
                  icon={<Briefcase className="w-5 h-5" />}
                  color={{
                    bg: "bg-purple-50",
                    bgDark: "dark:bg-purple-900/20",
                    border: "border-purple-200",
                    borderDark: "dark:border-purple-800",
                    text: "text-purple-700",
                    textDark: "dark:text-purple-300",
                    icon: "text-purple-600",
                    iconDark: "dark:text-purple-400",
                  }}
                  startTime={formData.workBlockStart}
                  endTime={formData.workBlockEnd}
                  minDuration={TIME_LIMITS.workBlock.min}
                  maxDuration={TIME_LIMITS.workBlock.max}
                  onStartTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, workBlockStart: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.workBlockStart;
                      delete newErrors.workBlockDuration;
                      delete newErrors.workBlockOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  onEndTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, workBlockEnd: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.workBlockEnd;
                      delete newErrors.workBlockDuration;
                      delete newErrors.workBlockOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  error={
                    validationErrors.workBlockDuration ||
                    validationErrors.workBlockOverlap ||
                    undefined
                  }
                  isEditing={true}
                />

                {/* Productive */}
                <TimeBlockCard
                  id="productive"
                  title="Productive"
                  icon={<Zap className="w-5 h-5" />}
                  color={{
                    bg: "bg-teal-50",
                    bgDark: "dark:bg-teal-900/20",
                    border: "border-teal-200",
                    borderDark: "dark:border-teal-800",
                    text: "text-teal-700",
                    textDark: "dark:text-teal-300",
                    icon: "text-teal-600",
                    iconDark: "dark:text-teal-400",
                  }}
                  startTime={formData.productiveStart}
                  endTime={formData.productiveEnd}
                  minDuration={TIME_LIMITS.productive.min}
                  maxDuration={TIME_LIMITS.productive.max}
                  onStartTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, productiveStart: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.productiveStart;
                      delete newErrors.productiveDuration;
                      delete newErrors.productiveOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  onEndTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, productiveEnd: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.productiveEnd;
                      delete newErrors.productiveDuration;
                      delete newErrors.productiveOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  error={
                    validationErrors.productiveDuration ||
                    validationErrors.productiveOverlap ||
                    undefined
                  }
                  isEditing={true}
                />

                {/* Family Time */}
                <TimeBlockCard
                  id="familyTime"
                  title="Family Time"
                  icon={<Users className="w-5 h-5" />}
                  color={{
                    bg: "bg-orange-50",
                    bgDark: "dark:bg-orange-900/20",
                    border: "border-orange-200",
                    borderDark: "dark:border-orange-800",
                    text: "text-orange-700",
                    textDark: "dark:text-orange-300",
                    icon: "text-orange-600",
                    iconDark: "dark:text-orange-400",
                  }}
                  startTime={formData.familyTimeStart}
                  endTime={formData.familyTimeEnd}
                  minDuration={TIME_LIMITS.familyTime.min}
                  maxDuration={TIME_LIMITS.familyTime.max}
                  onStartTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, familyTimeStart: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.familyTimeStart;
                      delete newErrors.familyTimeDuration;
                      delete newErrors.familyTimeOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  onEndTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, familyTimeEnd: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.familyTimeEnd;
                      delete newErrors.familyTimeDuration;
                      delete newErrors.familyTimeOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  error={
                    validationErrors.familyTimeDuration ||
                    validationErrors.familyTimeOverlap ||
                    undefined
                  }
                  isEditing={true}
                />

                {/* Journaling */}
                <TimeBlockCard
                  id="journal"
                  title="Journal"
                  icon={<BookOpen className="w-5 h-5" />}
                  color={{
                    bg: "bg-indigo-50",
                    bgDark: "dark:bg-indigo-900/20",
                    border: "border-indigo-200",
                    borderDark: "dark:border-indigo-800",
                    text: "text-indigo-700",
                    textDark: "dark:text-indigo-300",
                    icon: "text-indigo-600",
                    iconDark: "dark:text-indigo-400",
                  }}
                  startTime={formData.journalStart}
                  endTime={formData.journalEnd}
                  minDuration={TIME_LIMITS.journal.min}
                  maxDuration={TIME_LIMITS.journal.max}
                  onStartTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, journalStart: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.journalStart;
                      delete newErrors.journalDuration;
                      delete newErrors.journalOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  onEndTimeChange={(time) => {
                    setFormData((prev) => ({ ...prev, journalEnd: time }));
                    setValidationErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.journalEnd;
                      delete newErrors.journalDuration;
                      delete newErrors.journalOverlap;
                      return newErrors;
                    });
                    validateTimeAllocation();
                  }}
                  error={
                    validationErrors.journalDuration ||
                    validationErrors.journalOverlap ||
                    undefined
                  }
                  isEditing={true}
                />
              </div>

              {/* Submit Button */}
              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:via-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 min-w-[200px]"
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
            <input type="hidden" name="personalWorkStart" value={formData.personalWorkStart} />
            <input type="hidden" name="personalWorkEnd" value={formData.personalWorkEnd} />
            <input type="hidden" name="workBlockStart" value={formData.workBlockStart} />
            <input type="hidden" name="workBlockEnd" value={formData.workBlockEnd} />
            <input type="hidden" name="productiveStart" value={formData.productiveStart} />
            <input type="hidden" name="productiveEnd" value={formData.productiveEnd} />
            <input type="hidden" name="familyTimeStart" value={formData.familyTimeStart} />
            <input type="hidden" name="familyTimeEnd" value={formData.familyTimeEnd} />
            <input type="hidden" name="journalStart" value={formData.journalStart} />
            <input type="hidden" name="journalEnd" value={formData.journalEnd} />
          </form>
        </div>
      </div>
    </div>
  );
}
