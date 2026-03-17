import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.habitcracker.app",
  appName: "Habit Cracker",
  webDir: ".next",
  server: {
    // TODO: replace with your actual deployed HTTPS URL on Vercel.
    url: "https://habbit-app-virid.vercel.app/dashboard",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: true,
  },
};

export default config;

