/**
 * Firebase client SDK - for browser only.
 * Used to request permission, get FCM token, and handle foreground messages.
 * Do not import in server components or API routes.
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (getApps().length > 0) {
    return getApps()[0] as FirebaseApp;
  }
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  return initializeApp(firebaseConfig);
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}

/**
 * Register the Firebase messaging service worker and wait until it's activated.
 */
async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    if (reg.installing) {
      await new Promise<void>((resolve) => {
        reg.installing!.addEventListener("statechange", () => {
          if (reg.waiting || reg.active) resolve();
        });
      });
    }
    if (reg.waiting && !reg.active) {
      await new Promise<void>((resolve) => {
        reg.waiting!.addEventListener("statechange", () => resolve());
      });
    }
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn("[FCM] Service worker registration failed:", e);
    return null;
  }
}

/**
 * Request notification permission and get FCM token for this device.
 * Returns null if push isn't supported or fails (e.g. on localhost or blocked).
 */
export async function getFCMToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const messaging = getFirebaseMessaging();
  if (!messaging || !vapidKey) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const swRegistration = await getServiceWorkerRegistration();
    if (!swRegistration) return null;

    const options = { vapidKey, serviceWorkerRegistration: swRegistration };

    try {
      return (await getToken(messaging, options)) || null;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      return (await getToken(messaging, options)) || null;
    }
  } catch (e) {
    // Push often fails on localhost or when browser blocks it; don't spam console
    if (process.env.NODE_ENV === "development") {
      console.warn("[FCM] Push token unavailable (expected on localhost in some browsers):", (e as Error)?.message);
    }
    return null;
  }
}

/**
 * Subscribe to foreground messages (when app is open).
 */
export function onForegroundMessage(
  callback: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void
): (() => void) | null {
  if (typeof window === "undefined") return null;
  const messaging = getFirebaseMessaging();
  if (!messaging) return null;
  return onMessage(messaging, callback);
}
