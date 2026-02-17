"use client";

import { useState, useEffect } from "react";
import { Target, Briefcase, Zap, Users, BookOpen, Edit2, Check, X, Clock } from "lucide-react";

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
      className={`relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 transition-all duration-300 ${
        isEditing
          ? `${color.bg} ${color.bgDark} border-2 ${color.border} ${color.borderDark} shadow-lg`
          : `bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg`
      } ${isAnimating ? "scale-[1.02]" : ""} ${!isValid && isEditing ? "animate-shake" : ""}`}
    >
      {/* Gradient overlay */}
      <div className={`absolute inset-0 opacity-5 ${color.bg} ${color.bgDark} pointer-events-none`}></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl flex-shrink-0 ${color.bg} ${color.bgDark} ${color.icon} ${color.iconDark}`}>
              <div className="w-4 h-4 sm:w-5 sm:h-5">{icon}</div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold text-sm sm:text-base md:text-lg truncate ${color.text} ${color.textDark}`}>{title}</h3>
              {!isEditing && startTime && endTime && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {formatTimeForDisplay(startTime)} — {formatTimeForDisplay(endTime)}
                </p>
              )}
            </div>
          </div>
          {!isEditing && onEdit && (
            <button
              onClick={onEdit}
              className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <Edit2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              {onSave && (
                <button
                  onClick={onSave}
                  className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Time Display/Editor */}
        {isEditing ? (
          <div className="space-y-3 sm:space-y-4">
            {/* Time Inputs */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 sm:mb-2">
                  From
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                  className={`w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base rounded-lg sm:rounded-xl border-2 transition-all ${
                    isValid
                      ? "border-slate-200 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500"
                      : "border-red-300 dark:border-red-700 focus:border-red-400 dark:focus:border-red-500"
                  } bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 sm:mb-2">
                  To
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => onEndTimeChange(e.target.value)}
                  className={`w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm md:text-base rounded-lg sm:rounded-xl border-2 transition-all ${
                    isValid
                      ? "border-slate-200 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500"
                      : "border-red-300 dark:border-red-700 focus:border-red-400 dark:focus:border-red-500"
                  } bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900`}
                />
              </div>
            </div>

            {/* Duration Display */}
            {startTime && endTime && (
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Duration:</span>
                  <span
                    className={`font-semibold transition-colors ${
                      isValidDuration
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatDuration(duration)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 sm:h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverLimit
                        ? "bg-gradient-to-r from-red-400 to-red-600"
                        : isValidDuration
                        ? "bg-gradient-to-r from-green-400 to-green-600"
                        : "bg-gradient-to-r from-yellow-400 to-yellow-600"
                    }`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>

                {/* Validation Message */}
                {!isValidDuration && (
                  <p className="text-xs text-red-600 dark:text-red-400 animate-fade-in">
                    {duration < minDuration
                      ? `Selected time must be at least ${formatDuration(minDuration)}.`
                      : `Selected time must stay within ${formatDuration(minDuration)}–${formatDuration(maxDuration)}.`}
                  </p>
                )}
                {isValidDuration && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">Within allowed range</span>
                  </p>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-2 p-2 sm:p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-xs text-red-600 dark:text-red-400 break-words">{error}</p>
              </div>
            )}
          </div>
        ) : (
          /* Display Mode */
          <div className="space-y-2 sm:space-y-3">
            {startTime && endTime ? (
              <>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300 truncate">
                    {formatTimeForDisplay(startTime)} — {formatTimeForDisplay(endTime)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Duration:</span>
                  <span className={`font-semibold ${color.text} ${color.textDark}`}>
                    {formatDuration(duration)}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="relative h-2 sm:h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${color.bg} ${color.bgDark}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDuration(duration)} of {formatDuration(maxDuration)} max
                </p>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 italic text-center py-3 sm:py-4">
                No time allocated yet
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
