import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.habitcracker.app",
  appName: "Habit Cracker",
  webDir: ".next",
  server: {
    // TODO: replace with your actual deployed HTTPS URL on Vercel.
    url: "https://www.indydaze.com",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: true,
  },
};

export default config;

