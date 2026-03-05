import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  theme?: "light" | "dark";
  profilePicture?: string; // Base64 encoded image or URL
  dateOfBirth?: Date;
  age?: number;
  profession?: string;
  pinCode?: string;
  profileSetupCompleted?: boolean;
  timeCategories?: {
    personalWork?: {
      ranges: { startTime: string; endTime: string }[];
      totalHours?: number;
      minAllocation?: number;
    };
    workBlock?: {
      ranges: { startTime: string; endTime: string }[];
      totalHours?: number;
      minAllocation?: number;
    };
    productive?: {
      ranges: { startTime: string; endTime: string }[];
      totalHours?: number;
      minAllocation?: number;
    };
    familyTime?: {
      ranges: { startTime: string; endTime: string }[];
      totalHours?: number;
      minAllocation?: number;
    };
    journaling?: {
      ranges: { startTime: string; endTime: string }[];
      totalHours?: number;
    };
  };
  createdAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "light",
    },
    profilePicture: {
      type: String,
    },
    dateOfBirth: {
      type: Date,
    },
    age: {
      type: Number,
    },
    profession: {
      type: String,
      trim: true,
    },
    pinCode: {
      type: String,
      trim: true,
    },
    profileSetupCompleted: {
      type: Boolean,
      default: false,
    },
    timeCategories: {
      personalWork: {
        ranges: [
          {
            startTime: { type: String },
            endTime: { type: String },
          },
        ],
        totalHours: { type: Number, default: 2.5 },
        minAllocation: { type: Number, default: 50 },
      },
      workBlock: {
        ranges: [
          {
            startTime: { type: String },
            endTime: { type: String },
          },
        ],
        totalHours: { type: Number, default: 4 },
        minAllocation: { type: Number, default: 50 },
      },
      productive: {
        ranges: [
          {
            startTime: { type: String },
            endTime: { type: String },
          },
        ],
        totalHours: { type: Number, default: 3.5 },
        minAllocation: { type: Number, default: 50 },
      },
      familyTime: {
        ranges: [
          {
            startTime: { type: String },
            endTime: { type: String },
          },
        ],
        totalHours: { type: Number, default: 2 },
        minAllocation: { type: Number, default: 50 },
      },
      journaling: {
        ranges: [
          {
            startTime: { type: String },
            endTime: { type: String },
          },
        ],
        totalHours: { type: Number, default: 1 },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Note: email field already has unique: true which creates an index automatically
// No need to add a duplicate index

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
