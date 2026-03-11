import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Tracks sent push notifications to avoid duplicates.
 * e.g. one habit reminder per habit per day during time window.
 */
export type NotificationSentType = "habit" | "todo" | "meeting" | "birthday";

export interface INotificationSent extends Document {
  userId: Types.ObjectId;
  type: NotificationSentType;
  refId: Types.ObjectId; // habitId, calendar event _id, etc.
  date: string; // ISO date string (YYYY-MM-DD) for daily dedup
  sentAt: Date;
}

const NotificationSentSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["habit", "todo", "meeting", "birthday"],
      required: true,
      index: true,
    },
    refId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// One notification per type+refId+date per user
NotificationSentSchema.index({ userId: 1, type: 1, refId: 1, date: 1 }, { unique: true });

const NotificationSent: Model<INotificationSent> =
  mongoose.models.NotificationSent ||
  mongoose.model<INotificationSent>("NotificationSent", NotificationSentSchema);

export default NotificationSent;
