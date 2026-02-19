"use client";

import { useState, useEffect } from "react";
import { Target, Briefcase, Zap, Users, BookOpen, Edit2, Check, X, Clock, Plus, Minus } from "lucide-react";

interface TimeBlockCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: {
    bg: string;
    bgDark: string;
    border: string;
    borderDark: string;
    text: string;
    textDark: string;
    icon: string;
    iconDark: string;
  };
  startTime: string;
  endTime: string;
  minDuration: number; // in minutes
  maxDuration: number; // in minutes
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  error?: string;
  isEditing?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

// Helper function to convert time string (HH:MM) to minutes
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper function to calculate duration in minutes
function calculateDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end < start) {
    return (24 * 60) - start + end;
  }
  return end - start;
}

// Format time for display (HH:MM to 12-hour format)
function formatTimeForDisplay(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

// Format duration for display
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
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
  
  // Convert back to time string
  const hours = Math.floor(newEndMinutes / 60);
  const mins = newEndMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export default function TimeBlockCard({
  id,
  title,
  icon,
  color,
  startTime,
  endTime,
  minDuration,
  maxDuration,
  onStartTimeChange,
  onEndTimeChange,
  error,
  isEditing = false,
  onEdit,
  onSave,
  onCancel,
}: TimeBlockCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const duration = calculateDuration(startTime, endTime);
  const isValidDuration = duration >= minDuration && duration <= maxDuration;
  const progress = Math.min((duration / maxDuration) * 100, 100);
  const isOverLimit = duration > maxDuration;

  useEffect(() => {
    setIsValid(isValidDuration);
    if (startTime && endTime) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [startTime, endTime, isValidDuration]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
        isEditing
          ? `${color.bg} ${color.bgDark} border-2 ${color.border} ${color.borderDark} shadow-xl`
          : `bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl`
      } ${isAnimating ? "scale-[1.01]" : ""} ${!isValid && isEditing ? "animate-shake" : ""}`}
    >
      {/* Premium gradient overlay */}
      <div className={`absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-gradient-to-br ${color.bg} ${color.bgDark} pointer-events-none`}></div>
      
      {/* Soft glow effect */}
      <div className={`absolute -inset-0.5 bg-gradient-to-br ${color.border} ${color.borderDark} opacity-0 hover:opacity-20 dark:hover:opacity-10 rounded-2xl blur-xl transition-opacity duration-300 pointer-events-none`}></div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-8">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl flex-shrink-0 ${color.bg} ${color.bgDark} ${color.icon} ${color.iconDark} shadow-md`}>
              <div className="w-5 h-5 sm:w-6 sm:h-6">{icon}</div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`text-lg sm:text-xl lg:text-2xl font-bold mb-1 ${color.text} ${color.textDark}`}>{title}</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {formatDuration(minDuration)} - {formatDuration(maxDuration)} allowed
              </p>
            </div>
          </div>
        </div>

        {/* Time Display Section - Premium Design */}
        {isEditing ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Time Inputs - Large and Clear */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Start Time
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <Clock className={`h-4 w-4 sm:h-5 sm:w-5 ${color.icon} ${color.iconDark} opacity-60`} />
                  </div>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => onStartTimeChange(e.target.value)}
                    className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 text-base sm:text-lg font-medium rounded-lg sm:rounded-xl border-2 transition-all ${
                      isValid
                        ? "border-slate-200 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500"
                        : "border-red-300 dark:border-red-700 focus:border-red-400 dark:focus:border-red-500"
                    } bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 shadow-sm`}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                    End Time
                  </label>
                  {startTime && endTime && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newEndTime = adjustDuration(startTime, endTime, -15, minDuration, maxDuration);
                          if (newEndTime) {
                            onEndTimeChange(newEndTime);
                          }
                        }}
                        className={`p-1.5 rounded-lg ${color.bg} ${color.bgDark} ${color.icon} ${color.iconDark} hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95`}
                        title="Decrease by 15 minutes"
                      >
                        <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newEndTime = adjustDuration(startTime, endTime, 15, minDuration, maxDuration);
                          if (newEndTime) {
                            onEndTimeChange(newEndTime);
                          }
                        }}
                        className={`p-1.5 rounded-lg ${color.bg} ${color.bgDark} ${color.icon} ${color.iconDark} hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95`}
                        title="Increase by 15 minutes"
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <Clock className={`h-4 w-4 sm:h-5 sm:w-5 ${color.icon} ${color.iconDark} opacity-60`} />
                  </div>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => onEndTimeChange(e.target.value)}
                    className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 text-base sm:text-lg font-medium rounded-lg sm:rounded-xl border-2 transition-all ${
                      isValid
                        ? "border-slate-200 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500"
                        : "border-red-300 dark:border-red-700 focus:border-red-400 dark:focus:border-red-500"
                    } bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 shadow-sm`}
                  />
                </div>
              </div>
            </div>

            {/* Current Time Display - Large and Prominent */}
            {startTime && endTime && (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5 border border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Current Schedule</span>
                    <span
                      className={`text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded-lg ${
                        isValidDuration
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {formatDuration(duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-1 text-center p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">From</p>
                      <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                        {formatTimeForDisplay(startTime)}
                      </p>
                    </div>
                    <div className="text-slate-400 dark:text-slate-600 text-lg sm:text-xl font-bold">→</div>
                    <div className="flex-1 text-center p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">To</p>
                      <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                        {formatTimeForDisplay(endTime)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Duration Progress</span>
                    <span className={`font-bold ${
                      isValidDuration ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOverLimit
                          ? "bg-gradient-to-r from-red-400 to-red-600"
                          : isValidDuration
                          ? "bg-gradient-to-r from-green-400 to-green-600"
                          : "bg-gradient-to-r from-yellow-400 to-yellow-600"
                      } shadow-sm`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Validation Message */}
                {!isValidDuration && (
                  <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg sm:rounded-xl">
                    <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium">
                      {duration < minDuration
                        ? `⚠️ Selected time must be at least ${formatDuration(minDuration)}.`
                        : `⚠️ Selected time exceeds maximum of ${formatDuration(maxDuration)}.`}
                    </p>
                  </div>
                )}
                {isValidDuration && (
                  <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg sm:rounded-xl">
                    <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span>Time allocation is within allowed range</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg sm:rounded-xl">
                <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium break-words">{error}</p>
              </div>
            )}
          </div>
        ) : (
          /* Display Mode */
          <div className="space-y-3 sm:space-y-4">
            {startTime && endTime ? (
              <>
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5 border border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Schedule</span>
                    <span className={`text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded-lg ${color.bg} ${color.bgDark} ${color.text} ${color.textDark}`}>
                      {formatDuration(duration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex-1 text-center p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">From</p>
                      <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                        {formatTimeForDisplay(startTime)}
                      </p>
                    </div>
                    <div className="text-slate-400 dark:text-slate-600 text-lg sm:text-xl font-bold">→</div>
                    <div className="flex-1 text-center p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">To</p>
                      <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                        {formatTimeForDisplay(endTime)}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Duration</span>
                    <span className={`font-bold ${color.text} ${color.textDark}`}>
                      {formatDuration(duration)} / {formatDuration(maxDuration)}
                    </span>
                  </div>
                  <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${color.bg} ${color.bgDark} shadow-sm`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  No time allocated yet
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
