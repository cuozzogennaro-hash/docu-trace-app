import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type TaskAssignment = {
  id: string;
  user_id: string;
  operator_id: string;
  asset_id: string;
  task_type: string;
  due_time: string;
  frequency: string;
};

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

    // Compare in Europe/Rome timezone; only flag tasks overdue by 30+ minutes
    const now = new Date();
    const romeNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
    const thresholdDate = new Date(romeNow.getTime() - 30 * 60 * 1000);
    const thresholdTime = thresholdDate.toTimeString().slice(0, 5);

    const { data: allTasks, error: taskError } = await supabase
      .from("task_assignments")
      .select("id, user_id, operator_id, asset_id, task_type, due_time, frequency")
      .not("due_time", "is", null)
      .lte("due_time", thresholdTime);

    if (taskError) {
      console.error("Error fetching tasks:", taskError);
      return new Response(JSON.stringify({ error: taskError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (taskError) {
      console.error("Error fetching tasks:", taskError);
      return new Response(JSON.stringify({ error: taskError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!allTasks || allTasks.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No tasks with due_time" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For each task, check if it was already completed in the current period
    const overdueTasks: TaskAssignment[] = [];
    for (const task of allTasks as TaskAssignment[]) {
      const periodStart = getPeriodStart(task.frequency);

      let completed = false;
      if (task.task_type === "sanitation") {
        const { count } = await supabase
          .from("sanitations")
          .select("id", { count: "exact", head: true })
          .eq("operator_id", task.operator_id)
          .eq("asset_id", task.asset_id)
          .gte("event_date", periodStart);
        completed = (count ?? 0) > 0;
      } else {
        const { count } = await supabase
          .from("temperatures")
          .select("id", { count: "exact", head: true })
          .eq("operator_id", task.operator_id)
          .eq("asset_id", task.asset_id)
          .gte("event_date", periodStart);
        completed = (count ?? 0) > 0;
      }

      if (!completed) {
        overdueTasks.push(task);
      }
    }

    if (overdueTasks.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "All tasks completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique operator_ids from overdue tasks
    const operatorIds = [...new Set(overdueTasks.map((t) => t.operator_id))];

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

    // Admin push tokens
    const adminUserIds = [...new Set(overdueTasks.map((t) => t.user_id).filter(Boolean))];
    const adminTokenMap = new Map<string, any>();
    if (adminUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, push_token")
        .in("id", adminUserIds)
        .not("push_token", "is", null);
      for (const p of profiles || []) {
        if (p.push_token) adminTokenMap.set(p.id, p.push_token);
      }
    }

    // Operator names for admin messages
    const { data: opNames } = await supabase
      .from("operators")
      .select("id, name")
      .in("id", operatorIds);
    const opNameMap = new Map<string, string>();
    for (const o of opNames || []) opNameMap.set(o.id, o.name);

    // Get asset names for the notifications
    const assetIds = [...new Set(overdueTasks.map((t) => t.asset_id))];
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
      const assetName = assetMap.get(task.asset_id) || "Attrezzatura";
      const taskLabel = task.task_type === "sanitation" ? "Sanificazione" : "Rilevazione temperatura";
      const opName = opNameMap.get(task.operator_id) || "Operatore";

      const sub = tokenMap.get(task.operator_id);
      if (sub) {
        const payload = JSON.stringify({
          title: "DocuTrace HACCP",
          body: `⚠️ ${taskLabel} scaduta per ${assetName} (ore ${task.due_time})`,
          url: "/",
        });
        try {
          await sendWebPush(sub, payload, vapidPrivateKey, vapidPublicKey);
          sent++;
        } catch (pushErr: any) {
          console.error("Push send error (operator):", pushErr?.message || pushErr);
        }
      }

      const adminSub = adminTokenMap.get(task.user_id);
      if (adminSub) {
        const adminPayload = JSON.stringify({
          title: "DocuTrace HACCP",
          body: `⚠️ ${opName} non ha eseguito ${taskLabel.toLowerCase()} per ${assetName} (ore ${task.due_time})`,
          url: "/",
        });
        try {
          await sendWebPush(adminSub, adminPayload, vapidPrivateKey, vapidPublicKey);
          sent++;
        } catch (pushErr: any) {
          console.error("Push send error (admin):", pushErr?.message || pushErr);
        }
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

function getPeriodStart(frequency: string): string {
  const now = new Date();
  if (frequency === "weekly") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return monday.toISOString().slice(0, 10);
  }
  if (frequency === "monthly") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  return now.toISOString().slice(0, 10); // daily
}