"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { generateAccessToken, generateRefreshToken } from "@/lib/jwt";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Cookie configuration - single source of truth
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Ensure cookies persist for 25 days
  maxAge: 60 * 60 * 24 * 25, // 25 days in seconds
};

function setAuthCookies(accessToken: string, refreshToken: string) {
  try {
    const cookieStore = cookies();
    // Set both cookies - optimized single operation
    cookieStore.set("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 60 * 15, // 15 minutes
    });
    cookieStore.set("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 25, // 25 days
    });
  } catch (error) {
    throw error;
  }
}

export async function signup(formData: FormData) {
  try {
    const rawData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const validatedData = signupSchema.parse(rawData);
    
    // Start password hashing and DB connection in parallel for better performance
    const [dbConnection, hashedPassword] = await Promise.all([
      connectDB(),
      bcrypt.hash(validatedData.password, 10),
    ]);

    // Check if user already exists - use lean() and select() for faster query
    const existingUser = await User.findOne({ email: validatedData.email })
      .select("_id")
      .lean();
    if (existingUser) {
      return { error: "User with this email already exists" };
    }

    // Create user - only select needed fields
    const user = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
    });

    // Generate tokens (synchronous operations, but kept for consistency)
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set cookies
    setAuthCookies(accessToken, refreshToken);

    // Return success - client will handle redirect
    return { success: true, user: { id: user._id.toString(), name: user.name, email: user.email } };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    return { error: error.message || "Signup failed" };
  }
}

export async function login(formData: FormData) {
  try {
    const rawData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const validatedData = loginSchema.parse(rawData);
    await connectDB();

    // Find user with only needed fields - use lean() for faster query
    const user = await User.findOne({ email: validatedData.email })
      .select("_id email password name")
      .lean(); // Returns plain JS object, faster than Mongoose document

    if (!user) {
      return { error: "Invalid email or password" };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
    if (!isValidPassword) {
      return { error: "Invalid email or password" };
    }

    // Generate tokens (synchronous operations, but kept for consistency)
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Set cookies
    setAuthCookies(accessToken, refreshToken);

    // Return success - client will handle redirect
    return { success: true, user: { id: user._id.toString(), name: user.name, email: user.email } };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    return { error: error.message || "Login failed" };
  }
}

export async function refreshToken() {
  try {
    const cookieStore = cookies();
    const refreshTokenValue = cookieStore.get("refreshToken")?.value;

    if (!refreshTokenValue) {
      return { error: "No refresh token found" };
    }

    // Verify refresh token
    const { verifyRefreshToken } = await import("@/lib/jwt");
    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenValue);
    } catch (error) {
      // Refresh token is invalid or expired
      cookieStore.delete("accessToken");
      cookieStore.delete("refreshToken");
      return { error: "Refresh token expired" };
    }

    // Generate new access token
    const { generateAccessToken } = await import("@/lib/jwt");
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
    });

    // Set new access token cookie
    cookieStore.set("accessToken", newAccessToken, {
      ...cookieOptions,
      maxAge: 60 * 15, // 15 minutes
    });

    console.log("[AUTH] Token refreshed successfully");
    return { success: true, accessToken: newAccessToken };
  } catch (error: any) {
    console.error("[AUTH] Token refresh error:", error);
    return { error: error.message || "Token refresh failed" };
  }
}

export async function logout() {
  try {
    const cookieStore = cookies();
    cookieStore.delete("accessToken");
    cookieStore.delete("refreshToken");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Logout failed" };
  }
}
