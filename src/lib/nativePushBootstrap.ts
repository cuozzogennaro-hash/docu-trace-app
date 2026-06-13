import { Capacitor } from "@capacitor/core";

/**
 * Early native push bootstrap.
 *
 * Triggers the iOS / Android system permission prompt at app launch and
 * initializes Firebase Messaging so that APNs registration (and the FCM
 * token exchange) starts as soon as possible. Token persistence to the
 * database is still handled by `useNativePushNotifications` once a user
 * or operator session exists.
 *
 * No-op on web.
 */
export async function bootstrapNativePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

    // Explicitly request the native notification permission (shows the
    // iOS system prompt on first launch).
    let perm = await FirebaseMessaging.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await FirebaseMessaging.requestPermissions();
    }
    if (perm.receive !== "granted") {
      console.warn("[push:boot] notification permission not granted:", perm.receive);
      return;
    }

    // Register with APNs / FCM so the OS starts delivering tokens.
    try {
      await PushNotifications.register();
    } catch (err) {
      console.warn("[push:boot] PushNotifications.register failed:", err);
    }

    // Warm up Firebase Messaging so the FCM token is generated even before
    // the user logs in. The token is re-fetched and saved by the hook later.
    try {
      await FirebaseMessaging.getToken();
    } catch (err) {
      console.warn("[push:boot] FirebaseMessaging.getToken failed:", err);
    }
  } catch (err) {
    console.error("[push:boot] native push bootstrap failed:", err);
  }
}