import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { toast } from "sonner";
import { isNativePlatform } from "@/lib/platform";

const VAPID_PUBLIC_KEY = "BGmT6oQ93QrYnd-5CImnf19dXjid2-HobSAI1SxUaFEC1wfJY4ZAd3kEO6YnTbCzyBT5ZaVR4eYAIvor_s7d4GQ";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationBanner() {
  const { user } = useAuth();
  const { operator } = useOperatorSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isNativePlatform()) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "default") {
      setVisible(true);
    }
  }, []);

  async function handleEnable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permesso notifiche negato");
        setVisible(false);
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = subscription.toJSON();

      if (operator) {
        // Save push token to operator via RPC (bypasses RLS)
        const { data: result } = await supabase.rpc("save_operator_push_token", {
          p_operator_id: operator.id,
          p_pin: operator.pin || "",
          p_push_token: subJson as any,
        });
        if (result && !(result as any).ok) {
          console.error("Failed to save operator push token:", result);
          toast.error("Errore nel salvataggio del token notifiche");
          setVisible(false);
          return;
        }
      } else if (user) {
        // Fallback: save to admin profile
        await supabase
          .from("profiles")
          .update({ push_token: subJson as any })
          .eq("id", user.id);
      }

      toast.success("Notifiche attivate!");
      setVisible(false);
    } catch (err: any) {
      console.error("Push subscription error:", err);
      toast.error("Errore nell'attivazione delle notifiche");
    }
  }

  if (isNativePlatform() || !visible) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <Bell className="text-primary shrink-0" size={20} />
      <p className="flex-1 text-sm">Attiva le notifiche per ricevere avvisi sui compiti in scadenza.</p>
      <Button size="sm" onClick={handleEnable} className="shrink-0">
        Attiva Notifiche
      </Button>
    </div>
  );
}