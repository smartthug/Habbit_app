"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkProfileSetup } from "@/app/actions/profile";

export default function ProfileSetupGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      const result = await checkProfileSetup();
      if (result.success && !result.completed) {
        router.push("/profile-setup");
      } else {
        setChecking(false);
      }
    }
    check();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
