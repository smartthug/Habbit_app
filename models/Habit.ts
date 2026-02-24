import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IHabit extends Document {
  userId: Types.ObjectId;
  name: string;
  category: "family" | "business" | "personal" | "work" | "workBlock" | "productive" | "familyTime" | "custom" | "journal";
  startTime?: string; // Time slot start time (HH:mm format)
  endTime?: string; // Time slot end time (HH:mm format)
  timeline?: number; // Timeline in days (30, 60, 90, etc.)
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  // Frequency-specific settings
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday, 1 = Monday, etc.)
  dayOfMonth?: number; // 1-31 for monthly
  month?: number; // 0-11 for yearly (0 = January, 11 = December)
  priority: "low" | "medium" | "high";
  reminderTime?: string;
  ideaGenerating?: boolean;
  completionPercentage?: number; // Calculated completion percentage
  createdAt: Date;
}

const HabitSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Habit name is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["family", "business", "personal", "work", "workBlock", "productive", "familyTime", "custom", "journal"],
      default: "personal",
    },
    startTime: {
      type: String,
    },
    endTime: {
      type: String,
    },
    timeline: {
      type: Number,
      min: 1,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "custom"],
      default: "daily",
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    month: {
      type: Number,
      min: 0,
      max: 11,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    reminderTime: {
      type: String,
    },
    ideaGenerating: {
      type: Boolean,
      default: false,
    },
    completionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Habit: Model<IHabit> = mongoose.models.Habit || mongoose.model<IHabit>("Habit", HabitSchema);

export default Habit;
