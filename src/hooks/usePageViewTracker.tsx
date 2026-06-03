import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

const SESSION_KEY = "ht_session_id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|PlayBook|Silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}

export function usePageViewTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname;
    if (lastPath.current === path) return;
    lastPath.current = path;

    const payload = {
      session_id: getSessionId(),
      path,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      device: detectDevice(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      is_native: Capacitor.isNativePlatform(),
    };

    // Fire-and-forget; never block the UI on this.
    supabase.from("page_views" as any).insert(payload as any).then(() => {}, () => {});
  }, [location.pathname]);
}

export default function PageViewTracker() {
  usePageViewTracker();
  return null;
}