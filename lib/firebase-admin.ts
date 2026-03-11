/**
 * Firebase Admin SDK - server-side only.
 * Used to send push notifications via FCM.
 * Supports:
 * - FIREBASE_SERVICE_ACCOUNT_PATH: path to a .json file (recommended; .env can't do multi-line JSON)
 * - FIREBASE_SERVICE_ACCOUNT_JSON: full JSON string on a single line
 * - Or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  // Option 1: Load from file (best for multi-line JSON; add the file to .gitignore)
  if (serviceAccountPath) {
    try {
      const resolved = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.join(process.cwd(), serviceAccountPath);
      const raw = fs.readFileSync(resolved, "utf8");
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      return admin.app();
    } catch (e) {
      console.error("[Firebase Admin] Error loading FIREBASE_SERVICE_ACCOUNT_PATH:", e);
      throw new Error("Invalid Firebase service account file");
    }
  }

  // Option 2: Inline JSON (must be a single line in .env)
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      return admin.app();
    } catch (e) {
      console.error("[Firebase Admin] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", e);
      throw new Error("Invalid Firebase service account configuration");
    }
  }

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return admin.app();
  }

  throw new Error(
    "Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
  );
}

export function getMessaging() {
  return getFirebaseAdmin().messaging();
}

export type FCMDataPayload = Record<string, string>;

/**
 * Send a data-only FCM message (works when app is in background/closed).
 * Service worker will receive it and show the notification with optional actions.
 */
export async function sendFCMToToken(
  token: string,
  data: FCMDataPayload,
  options?: { title?: string; body?: string }
): Promise<string | null> {
  try {
    const messaging = getMessaging();
    const message: admin.messaging.Message = {
      token,
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      notification: options?.title
        ? {
            title: options.title,
            body: options.body ?? "",
          }
        : undefined,
      webpush: {
        fcmOptions: {
          link: process.env.NEXT_PUBLIC_APP_URL || "/dashboard",
        },
      },
    };
    const id = await messaging.send(message);
    return id;
  } catch (error: any) {
    // Invalid token / unregistered - caller may want to remove token
    if (error?.code === "messaging/registration-token-not-registered" || error?.code === "messaging/invalid-registration-token") {
      console.warn("[FCM] Invalid or unregistered token:", token?.slice(0, 20) + "...");
      throw error;
    }
    console.error("[FCM] Send error:", error?.message || error);
    throw error;
  }
}

/**
 * Send the same payload to multiple tokens (e.g. one user, multiple devices).
 */
export async function sendFCMToTokens(
  tokens: string[],
  data: FCMDataPayload,
  options?: { title?: string; body?: string }
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];
  for (const token of tokens) {
    try {
      await sendFCMToToken(token, data, options);
      success.push(token);
    } catch {
      failed.push(token);
    }
  }
  return { success, failed };
}
