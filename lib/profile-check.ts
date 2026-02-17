import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import User from "@/models/User";

export async function requireProfileSetup() {
  const tokenUser = await getCurrentUser();
  if (!tokenUser) {
    redirect("/auth/login");
  }

  try {
    await connectDB();
    const dbUser = await User.findById(tokenUser.userId).select("profileSetupCompleted").lean();
    
    if (!dbUser || !dbUser.profileSetupCompleted) {
      redirect("/profile-setup");
    }
  } catch (error) {
    console.error("Error checking profile setup:", error);
    // On error, allow access (fail open)
  }
}
