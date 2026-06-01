import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPaddleEnvironment } from "@/lib/paddle";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  updated_at: string;
};

export type AccessState = {
  loading: boolean;
  subscription: SubscriptionRow | null;
  hasAccess: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  trialDaysLeft: number | null;
  pastDueDaysLeft: number | null;
  refetch: () => Promise<void>;
};

export function useSubscription(): AccessState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);

  const fetchSub = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const env = getPaddleEnvironment();
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as SubscriptionRow) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchSub();
  }, [fetchSub]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => { fetchSub(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSub]);

  const now = Date.now();
  const endMs = subscription?.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
  const updatedMs = subscription?.updated_at ? new Date(subscription.updated_at).getTime() : null;
  const status = subscription?.status ?? null;
  const isTrialing = status === "trialing" && (endMs === null || endMs > now);
  const isActive = status === "active" && (endMs === null || endMs > now);
  const isPastDue =
    status === "past_due" && updatedMs !== null && now - updatedMs < 7 * 24 * 60 * 60 * 1000;
  const isCanceledWithAccess = status === "canceled" && endMs !== null && endMs > now;
  const isCanceled = status === "canceled";
  const hasAccess = !!subscription && (isTrialing || isActive || isPastDue || isCanceledWithAccess);

  const trialDaysLeft =
    isTrialing && endMs ? Math.max(0, Math.ceil((endMs - now) / (24 * 60 * 60 * 1000))) : null;
  const pastDueDaysLeft =
    isPastDue && updatedMs
      ? Math.max(0, 7 - Math.floor((now - updatedMs) / (24 * 60 * 60 * 1000)))
      : null;

  return {
    loading,
    subscription,
    hasAccess,
    isTrialing,
    isPastDue,
    isCanceled,
    trialDaysLeft,
    pastDueDaysLeft,
    refetch: fetchSub,
  };
}