import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// Mark as dynamic since we use cookies
export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  
  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/auth/login");
  }
}
