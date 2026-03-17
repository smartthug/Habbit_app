import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  PushNotificationToken,
  PushNotificationSchema,
  ActionPerformed,
} from "@capacitor/push-notifications";

export async function setupNativePush() {
  if (!Capacitor.isNativePlatform()) return;

  const permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive !== "granted") {
    const req = await PushNotifications.requestPermissions();
    if (req.receive !== "granted") return;
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token: PushNotificationToken) => {
    try {
      await fetch("/api/notifications/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: token.value, platform: "android-native" }),
      });
    } catch (e) {
      console.warn("[CapacitorPush] Failed to register native push token", e);
    }
  });

  PushNotifications.addListener("registrationError", (error) => {
    console.error("[CapacitorPush] Push registration error", error);
  });

  PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
    console.log("[CapacitorPush] Push received", notification);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
    console.log("[CapacitorPush] Push action performed", action);
  });
}

