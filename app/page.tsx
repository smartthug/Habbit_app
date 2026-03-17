"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    console.log("STEP 1: Home page loaded");
  }, []);

  return <div>App is working</div>;
}
