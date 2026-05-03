import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push helpers
async function sendWebPush(subscription: any, payload: string, vapidPrivateKey: string, vapidPublicKey: string) {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    console.log("Invalid subscription, skipping:", JSON.stringify(subscription));
    return;
  }

  // Use web-push via fetch to the push service
  // For simplicity, we'll use a direct fetch with VAPID headers
  const { default: webpush } = await import("npm:web-push@3.6.7");

  webpush.setVapidDetails(
    "mailto:noreply@docutrace.app",
    vapidPublicKey,
    vapidPrivateKey
  );

  await webpush.sendNotification(subscription, payload);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get current time as HH:MM
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    // Find overdue task assignments: due_time <= now AND status = 'pending'
    const { data: overdueTasks, error: taskError } = await supabase
      .from("task_assignments")
      .select("id, operator_id, asset_id, task_type, due_time")
      .eq("status", "pending")
      .not("due_time", "is", null)
      .lte("due_time", currentTime);

    if (taskError) {
      console.error("Error fetching tasks:", taskError);
      return new Response(JSON.stringify({ error: taskError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No overdue tasks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique operator_ids from overdue tasks
    const operatorIds = [...new Set(overdueTasks.map((t: any) => t.operator_id))];

    // Get push tokens for those operators
    const { data: operators, error: opError } = await supabase
      .from("operators")
      .select("id, push_token")
      .in("id", operatorIds)
      .not("push_token", "is", null);

    if (opError) {
      console.error("Error fetching operators:", opError);
      return new Response(JSON.stringify({ error: opError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenMap = new Map<string, any>();
    for (const p of operators || []) {
      if (p.push_token) tokenMap.set(p.id, p.push_token);
    }

    // Get asset names for the notifications
    const assetIds = [...new Set(overdueTasks.map((t: any) => t.asset_id))];
    const { data: assets } = await supabase
      .from("assets")
      .select("id, name")
      .in("id", assetIds);

    const assetMap = new Map<string, string>();
    for (const a of assets || []) {
      assetMap.set(a.id, a.name);
    }

    let sent = 0;
    for (const task of overdueTasks) {
      const sub = tokenMap.get(task.operator_id);
      if (!sub) continue;

      const assetName = assetMap.get(task.asset_id) || "Attrezzatura";
      const taskLabel = task.task_type === "sanitation" ? "Sanificazione" : "Rilevazione temperatura";

      const payload = JSON.stringify({
        title: "DocuTrace HACCP",
        body: `⚠️ ${taskLabel} scaduta per ${assetName} (ore ${task.due_time})`,
        url: "/",
      });

      try {
        await sendWebPush(sub, payload, vapidPrivateKey, vapidPublicKey);
        sent++;
      } catch (pushErr: any) {
        console.error("Push send error:", pushErr?.message || pushErr);
      }
    }

    return new Response(JSON.stringify({ sent, total: overdueTasks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});