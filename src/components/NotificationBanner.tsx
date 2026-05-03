import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BJxEsCkdEVvr66LuAroecddqKb3BygDlYKT8WvMBo47jhrCfpXUJOXjj2ANo7v2yhxIfEDZUT-gpxHd3tqhNu-A";

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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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

      if (user) {
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

  if (!visible) return null;

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