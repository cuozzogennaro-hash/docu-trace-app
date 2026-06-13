import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";

/**
 * On native platforms (iOS/Android) request push permission, register with
 * APNs/FCM, and persist the resulting token in the database against either
 * the active operator or the logged-in admin profile.
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

        await PushNotifications.addListener("registration", async (token) => {
          if (cancelled) return;
          const value = token.value;
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
          } catch (err) {
            console.error("[push] failed to save native token:", err);
          }
        });

        await PushNotifications.addListener("registrationError", (err) => {
          console.error("[push] registration error:", err);
        });

        await PushNotifications.addListener("pushNotificationReceived", (n) => {
          console.log("[push] received:", n);
        });

        await PushNotifications.register();
      } catch (err) {
        console.error("[push] init failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, operator?.id]);
}