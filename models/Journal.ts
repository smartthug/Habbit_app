import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IJournal extends Document {
  userId: Types.ObjectId;
  habitId?: Types.ObjectId;
  category: "personal" | "workBlock" | "productive" | "familyTime";
  whatWorked: {
    answer?: "yes" | "no";
    text: string;
  };
  whatWastedTime: {
    answer?: "yes" | "no";
    text: string;
  };
  whereMoneyGenerated: {
    answer: "yes" | "no";
    text?: string;
  };
  whereLostEnergy: string;
  howYouFeel?: "sad" | "neutral" | "good";
  createdAt: Date;
}

const JournalSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    habitId: {
      type: Schema.Types.ObjectId,
      ref: "Habit",
    },
    category: {
      type: String,
      enum: ["personal", "workBlock", "productive", "familyTime"],
      required: [true, "Category is required"],
    },
    whatWorked: {
      answer: {
        type: String,
        enum: ["yes", "no"],
        default: "no",
      },
      text: {
        type: String,
        required: true,
        trim: true,
      },
    },
    whatWastedTime: {
      answer: {
        type: String,
        enum: ["yes", "no"],
        default: "no",
      },
      text: {
        type: String,
        required: true,
        trim: true,
      },
    },
    whereMoneyGenerated: {
      answer: {
        type: String,
        enum: ["yes", "no"],
        required: true,
      },
      text: {
        type: String,
        trim: true,
      },
    },
    whereLostEnergy: {
      type: String,
      required: true,
      trim: true,
    },
    howYouFeel: {
      type: String,
      enum: ["sad", "neutral", "good"],
    },
  },
  {
    timestamps: true,
  }
);

const Journal: Model<IJournal> =
  mongoose.models.Journal || mongoose.model<IJournal>("Journal", JournalSchema);

export default Journal;
