import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";

/**
 * On native platforms (iOS/Android) request push permission, register with
 * APNs/FCM via Firebase, and persist the resulting **FCM token** in the
 * database against either the active operator or the logged-in admin profile.
 *
 * On iOS we still call @capacitor/push-notifications#register() so the system
 * asks for permission and registers the device with APNs. Firebase's iOS SDK
 * then swizzles the APNs delegate, exchanges the APNs token for an FCM token,
 * and we read that token via @capacitor-firebase/messaging#getToken().
 *
 * This hook is a no-op on web — Web Push is still handled by
 * NotificationBanner.
 */
export function useNativePushNotifications() {
  const { user } = useAuth();
  const { operator } = useOperatorSession();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user && !operator) return;

    let cancelled = false;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        const platform = Capacitor.getPlatform(); // 'ios' | 'android'

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== "granted") {
          console.warn("[push] permission not granted:", perm.receive);
          return;
        }

        await PushNotifications.removeAllListeners();

        const saveFcmToken = async (value: string) => {
          if (cancelled || !value) return;
          try {
            if (operator) {
              await supabase.rpc("save_operator_native_push_token", {
                p_operator_id: operator.id,
                p_pin: operator.pin || "",
                p_native_token: value,
                p_platform: platform,
              });
            } else if (user) {
              await supabase
                .from("profiles")
                .update({ native_push_token: value, native_platform: platform } as any)
                .eq("id", user.id);
            }
            console.log("[push] saved FCM token");
          } catch (err) {
            console.error("[push] failed to save FCM token:", err);
          }
        };

        // When APNs (iOS) or FCM (Android) returns a device token, fetch the
        // matching FCM token from Firebase and store THAT (not the raw APNs
        // token, which the FCM HTTP v1 API does not accept).
        await PushNotifications.addListener("registration", async () => {
          try {
            const { token } = await FirebaseMessaging.getToken();
            await saveFcmToken(token);
          } catch (err) {
            console.error("[push] FirebaseMessaging.getToken failed:", err);
          }
        });

        await PushNotifications.addListener("registrationError", (err) => {
          console.error("[push] registration error:", err);
        });

        await PushNotifications.addListener("pushNotificationReceived", (n) => {
          console.log("[push] received:", n);
        });

        await PushNotifications.register();

        // Also listen for token refresh events from Firebase directly.
        try {
          await FirebaseMessaging.removeAllListeners();
          await FirebaseMessaging.addListener("tokenReceived", (event: { token: string }) => {
            saveFcmToken(event.token);
          });
        } catch (err) {
          console.warn("[push] FirebaseMessaging listener setup failed:", err);
        }
      } catch (err) {
        console.error("[push] init failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, operator?.id]);
}