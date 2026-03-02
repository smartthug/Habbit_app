"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, MapPin, Bell, Repeat } from "lucide-react";
import { createCalendarEvent, updateCalendarEvent } from "@/app/actions/calendar";
import { useRouter } from "next/navigation";

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  event?: any;
}

export default function CalendarEventModal({
  isOpen,
  onClose,
  selectedDate,
  event,
}: CalendarEventModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    type: "todo" as "meeting" | "todo" | "birthday",
    description: "",
    date: "",
    time: "",
    deadline: "",
    reminderEnabled: false,
    reminderMinutesBefore: 15,
    location: "",
    recurringEnabled: false,
    recurringFrequency: "yearly" as "daily" | "weekly" | "monthly" | "yearly",
    recurringEndDate: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (event) {
        // Edit mode
        const eventDate = new Date(event.date);
        setFormData({
          title: event.title || "",
          type: event.type || "todo",
          description: event.description || "",
          date: eventDate.toISOString().split("T")[0],
          time: event.time || "",
          deadline: event.deadline
            ? new Date(event.deadline).toISOString().split("T")[0]
            : "",
          reminderEnabled: event.reminder?.enabled || false,
          reminderMinutesBefore: event.reminder?.minutesBefore || 15,
          location: event.location || "",
          recurringEnabled: event.recurring?.enabled || false,
          recurringFrequency: event.recurring?.frequency || "yearly",
          recurringEndDate: event.recurring?.endDate
            ? new Date(event.recurring.endDate).toISOString().split("T")[0]
            : "",
        });
      } else {
        // Create mode
        const date = selectedDate || new Date();
        setFormData({
          title: "",
          type: "todo",
          description: "",
          date: date.toISOString().split("T")[0],
          time: "",
          deadline: "",
          reminderEnabled: false,
          reminderMinutesBefore: 15,
          location: "",
          recurringEnabled: false,
          recurringFrequency: "yearly",
          recurringEndDate: "",
        });
      }
      setError("");
    }
  }, [isOpen, event, selectedDate]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formDataObj = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        formDataObj.append(key, value.toString());
      }
    });

    try {
      let result;
      if (event) {
        result = await updateCalendarEvent(event._id, formDataObj);
      } else {
        result = await createCalendarEvent(formDataObj);
      }

      if (result.success) {
        onClose();
        router.refresh();
      } else {
        setError(result.error || "Failed to save event");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full h-full md:h-auto md:max-w-2xl bg-slate-50 dark:bg-slate-900 rounded-3xl md:rounded-3xl shadow-premium-xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-800/50">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {event ? "Edit Todo" : "New Todo"}
          </h2>
          <button
            onClick={onClose}
            className="tap-target p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
              placeholder="Event title"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["meeting", "todo", "birthday"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, type })}
                  className={`tap-target px-4 py-3 rounded-xl font-semibold transition-all ${
                    formData.type === type
                      ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Time
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Deadline/Completion Date (Todo only) */}
          {formData.type === "todo" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Deadline / Completion Date
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                placeholder="Optional deadline"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Set a deadline or completion date for this task
              </p>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
              placeholder="Event location"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 resize-none"
              placeholder="Event description"
            />
          </div>

          {/* Reminder */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.reminderEnabled}
                onChange={(e) =>
                  setFormData({ ...formData, reminderEnabled: e.target.checked })
                }
                className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Set Reminder
              </span>
            </label>
            {formData.reminderEnabled && (
              <div className="mt-3">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Remind me
                </label>
                <select
                  value={formData.reminderMinutesBefore}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reminderMinutesBefore: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                >
                  <option value={5}>5 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>
            )}
          </div>

          {/* Recurring */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.recurringEnabled}
                onChange={(e) =>
                  setFormData({ ...formData, recurringEnabled: e.target.checked })
                }
                className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              <Repeat className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Recurring Event
              </span>
            </label>
            {formData.recurringEnabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Frequency
                  </label>
                  <select
                    value={formData.recurringFrequency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        recurringFrequency: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.recurringEndDate}
                    onChange={(e) =>
                      setFormData({ ...formData, recurringEndDate: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : event ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
