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
      startTime: string;
      endTime: string;
      totalHours: number;
      minAllocation: number;
    };
    workBlock?: {
      startTime: string;
      endTime: string;
      totalHours: number;
      minAllocation: number;
    };
    productive?: {
      startTime: string;
      endTime: string;
      totalHours: number;
      minAllocation: number;
    };
    familyTime?: {
      startTime: string;
      endTime: string;
      totalHours: number;
      minAllocation: number;
    };
    journaling?: {
      startTime: string;
      endTime: string;
      totalHours: number;
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
        startTime: { type: String },
        endTime: { type: String },
        totalHours: { type: Number, default: 2.5 },
        minAllocation: { type: Number, default: 50 },
      },
      workBlock: {
        startTime: { type: String },
        endTime: { type: String },
        totalHours: { type: Number, default: 4 },
        minAllocation: { type: Number, default: 50 },
      },
      productive: {
        startTime: { type: String },
        endTime: { type: String },
        totalHours: { type: Number, default: 3.5 },
        minAllocation: { type: Number, default: 50 },
      },
      familyTime: {
        startTime: { type: String },
        endTime: { type: String },
        totalHours: { type: Number, default: 2 },
        minAllocation: { type: Number, default: 50 },
      },
      journaling: {
        startTime: { type: String },
        endTime: { type: String },
        totalHours: { type: Number, default: 1 },
      },
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
