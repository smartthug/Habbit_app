import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICalendar extends Document {
  userId: Types.ObjectId;
  title: string;
  type: "meeting" | "event" | "birthday" | "habit";
  description?: string;
  date: Date;
  time?: string;
  habitId?: Types.ObjectId; // Link to habit if this is a habit event
  reminder?: {
    enabled: boolean;
    minutesBefore: number; // e.g., 15, 30, 60, 1440 (1 day)
  };
  location?: string;
  recurring?: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    endDate?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CalendarSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["meeting", "event", "birthday", "habit"],
      required: true,
      default: "event",
    },
    habitId: {
      type: Schema.Types.ObjectId,
      ref: "Habit",
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
      index: true,
    },
    time: {
      type: String,
      // Format: "HH:mm" (24-hour format)
    },
    reminder: {
      enabled: {
        type: Boolean,
        default: false,
      },
      minutesBefore: {
        type: Number,
        default: 15,
      },
    },
    location: {
      type: String,
      trim: true,
    },
    recurring: {
      enabled: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly"],
        default: "yearly",
      },
      endDate: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
CalendarSchema.index({ userId: 1, date: 1 });
CalendarSchema.index({ userId: 1, type: 1 });

const Calendar: Model<ICalendar> = mongoose.models.Calendar || mongoose.model<ICalendar>("Calendar", CalendarSchema);

export default Calendar;
