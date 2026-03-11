/**
 * Firebase Cloud Messaging - Service Worker
 * Handles background push notifications (when app or browser is closed).
 * Shows notification with title, body, and action buttons (Complete/Skip for habits).
 */
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

let messaging = null;

async function getConfig() {
  const origin = self.location?.origin || "http://localhost:3000";
  const res = await fetch(`${origin}/api/firebase-config`);
  if (!res.ok) throw new Error("Failed to fetch Firebase config");
  return res.json();
}

function getAppUrl() {
  const base = self.location?.origin || "http://localhost:3000";
  return `${base}/dashboard`;
}

function getHabitLogUrl(action, habitId, date) {
  const base = self.location?.origin || "http://localhost:3000";
  return `${base}/api/habits/log`;
}

async function initFirebase() {
  const config = await getConfig();
  if (!config.apiKey || !config.projectId) {
    console.warn("[firebase-messaging-sw] Missing Firebase config");
    return null;
  }
  firebase.initializeApp(config);
  messaging = firebase.messaging();
  return messaging;
}

function showNotification(title, options) {
  const opts = {
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    ...options,
  };
  return self.registration.showNotification(title, opts);
}

/**
 * Handle habit action (Complete/Skip) via API. Service worker can't send cookies
 * in a different context, so we open the app with query params and the client
 * will call the API. Alternatively we post from the notification click.
 * We use a dedicated action URL that the client can intercept: open app with
 * ?habitAction=complete&habitId=xxx so the dashboard can call the log API.
 */
function openAppWithHabitAction(action, habitId) {
  const url = new URL(getAppUrl());
  url.searchParams.set("habitAction", action);
  url.searchParams.set("habitId", habitId);
  url.searchParams.set("from", "notification");
  return url.toString();
}

initFirebase().then((msg) => {
  if (!msg) return;

  firebase.messaging().onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const type = data.type || "unknown";
    const title = payload.notification?.title || data.title || "Notification";
    const body = payload.notification?.body || data.message || data.body || "";

    const notificationOptions = {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: type + "-" + (data.habitId || data.eventId || Date.now()),
      requireInteraction: type === "habit",
      data: { ...data, url: getAppUrl() },
    };

    if (type === "habit" && data.habitId) {
      const showSkip = data.showSkip === "true";
      notificationOptions.actions = [
        { action: "complete", title: "Complete", icon: "/favicon.ico" },
      ];
      if (showSkip) {
        notificationOptions.actions.push({ action: "skip", title: "Skip", icon: "/favicon.ico" });
      }
    }

    return showNotification(title, notificationOptions);
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action || "open";

  let targetUrl = data.url || getAppUrl();
  if (data.type === "habit" && data.habitId && (action === "complete" || action === "skip")) {
    targetUrl = openAppWithHabitAction(action, data.habitId);
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
