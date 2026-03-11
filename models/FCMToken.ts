import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Stores FCM device tokens per user for push notifications.
 * One user can have multiple tokens (e.g. desktop + mobile).
 */
export interface IFCMToken extends Document {
  userId: Types.ObjectId;
  token: string;
  deviceLabel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FCMTokenSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
    },
    deviceLabel: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

FCMTokenSchema.index({ token: 1 }, { unique: true }); // unique token per device

const FCMToken: Model<IFCMToken> =
  mongoose.models.FCMToken || mongoose.model<IFCMToken>("FCMToken", FCMTokenSchema);

export default FCMToken;
