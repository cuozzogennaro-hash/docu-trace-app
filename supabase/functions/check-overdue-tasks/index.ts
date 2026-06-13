import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type TaskAssignment = {
  id: string;
  user_id: string;
  operator_id: string;
  asset_id: string;
  task_type: string;
  due_time: string;
  frequency: string;
  last_notified_at: string | null;
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

// ===== FCM HTTP v1 helpers =====
let cachedFcmToken: { token: string; exp: number } | null = null;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(bytes: Uint8Array | string): string {
  const str = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(str).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getFcmAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmToken && cachedFcmToken.exp - 60 > now) return cachedFcmToken.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: unknown) => b64url(JSON.stringify(o));
  const unsigned = `${enc(header)}.${enc(claim)}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) throw new Error(`FCM token exchange failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  cachedFcmToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return cachedFcmToken.token;
}

async function sendFcmV1(
  sa: any,
  deviceToken: string,
  platform: string | null,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  const accessToken = await getFcmAccessToken(sa);
  const message: any = {
    token: deviceToken,
    notification: { title, body },
    data,
  };
  if (platform === "ios") {
    message.apns = { payload: { aps: { sound: "default", badge: 1 } } };
  } else if (platform === "android") {
    message.android = { priority: "HIGH", notification: { sound: "default" } };
  }
  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    },
  );
  if (!resp.ok) {
    throw new Error(`FCM send failed: ${resp.status} ${await resp.text()}`);
  }
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
    const firebaseSaRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    let firebaseSa: any = null;
    if (firebaseSaRaw) {
      try {
        firebaseSa = JSON.parse(firebaseSaRaw);
      } catch (e) {
        console.error("Invalid FIREBASE_SERVICE_ACCOUNT JSON:", (e as Error).message);
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Compare in Europe/Rome timezone; only flag tasks overdue by 30+ minutes
    const now = new Date();
    const romeNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
    const thresholdDate = new Date(romeNow.getTime() - 30 * 60 * 1000);
    const thresholdTime = thresholdDate.toTimeString().slice(0, 5);

    const { data: allTasks, error: taskError } = await supabase
      .from("task_assignments")
      .select("id, user_id, operator_id, asset_id, task_type, due_time, frequency, last_notified_at")
      .not("due_time", "is", null)
      .lte("due_time", thresholdTime);

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

    // Throttle: max 1 push per 10 minutes per task_assignment
    const COOLDOWN_MS = 10 * 60 * 1000;
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_MS);
    const tasksToNotify = overdueTasks.filter((t) => {
      if (!t.last_notified_at) return true;
      return new Date(t.last_notified_at) < cooldownCutoff;
    });

    if (tasksToNotify.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, total: overdueTasks.length, message: "All overdue tasks within cooldown" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get unique operator_ids from overdue tasks
    const operatorIds = [...new Set(tasksToNotify.map((t) => t.operator_id))];

    // Get push tokens for those operators (web + native)
    const { data: operators, error: opError } = await supabase
      .from("operators")
      .select("id, push_token, native_push_token, native_platform")
      .in("id", operatorIds);

    if (opError) {
      console.error("Error fetching operators:", opError);
      return new Response(JSON.stringify({ error: opError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenMap = new Map<string, any>();
    const nativeTokenMap = new Map<string, { token: string; platform: string | null }>();
    for (const p of operators || []) {
      if (p.push_token) tokenMap.set(p.id, p.push_token);
      if ((p as any).native_push_token) {
        nativeTokenMap.set(p.id, {
          token: (p as any).native_push_token,
          platform: (p as any).native_platform ?? null,
        });
      }
    }

    // Admin push tokens
    const adminUserIds = [...new Set(tasksToNotify.map((t) => t.user_id).filter(Boolean))];
    const adminTokenMap = new Map<string, any>();
    const adminNativeTokenMap = new Map<string, { token: string; platform: string | null }>();
    if (adminUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, push_token, native_push_token, native_platform")
        .in("id", adminUserIds);
      for (const p of profiles || []) {
        if (p.push_token) adminTokenMap.set(p.id, p.push_token);
        if ((p as any).native_push_token) {
          adminNativeTokenMap.set(p.id, {
            token: (p as any).native_push_token,
            platform: (p as any).native_platform ?? null,
          });
        }
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
    const assetIds = [...new Set(tasksToNotify.map((t) => t.asset_id))];
    const { data: assets } = await supabase
      .from("assets")
      .select("id, name")
      .in("id", assetIds);

    const assetMap = new Map<string, string>();
    for (const a of assets || []) {
      assetMap.set(a.id, a.name);
    }

    let sent = 0;
    const notifiedIds: string[] = [];
    for (const task of tasksToNotify) {
      const assetName = assetMap.get(task.asset_id) || "Attrezzatura";
      const taskLabel = task.task_type === "sanitation" ? "Sanificazione" : "Rilevazione temperatura";
      const opName = opNameMap.get(task.operator_id) || "Operatore";

      let taskNotified = false;
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
          taskNotified = true;
        } catch (pushErr: any) {
          console.error("Push send error (operator):", pushErr?.message || pushErr);
        }
      }

      const nativeOp = nativeTokenMap.get(task.operator_id);
      if (nativeOp && firebaseSa) {
        try {
          await sendFcmV1(
            firebaseSa,
            nativeOp.token,
            nativeOp.platform,
            "DocuTrace HACCP",
            `⚠️ ${taskLabel} scaduta per ${assetName} (ore ${task.due_time})`,
            { url: "/", task_id: task.id },
          );
          sent++;
          taskNotified = true;
        } catch (pushErr: any) {
          console.error("FCM send error (operator):", pushErr?.message || pushErr);
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
          taskNotified = true;
        } catch (pushErr: any) {
          console.error("Push send error (admin):", pushErr?.message || pushErr);
        }
      }

      const nativeAdmin = adminNativeTokenMap.get(task.user_id);
      if (nativeAdmin && firebaseSa) {
        try {
          await sendFcmV1(
            firebaseSa,
            nativeAdmin.token,
            nativeAdmin.platform,
            "DocuTrace HACCP",
            `⚠️ ${opName} non ha eseguito ${taskLabel.toLowerCase()} per ${assetName} (ore ${task.due_time})`,
            { url: "/", task_id: task.id },
          );
          sent++;
          taskNotified = true;
        } catch (pushErr: any) {
          console.error("FCM send error (admin):", pushErr?.message || pushErr);
        }
      }

      if (taskNotified) {
        notifiedIds.push(task.id);
      }
    }

    if (notifiedIds.length > 0) {
      const { error: updErr } = await supabase
        .from("task_assignments")
        .update({ last_notified_at: new Date().toISOString() })
        .in("id", notifiedIds);
      if (updErr) console.error("Failed to update last_notified_at:", updErr.message);
    }

    return new Response(JSON.stringify({ sent, total: overdueTasks.length, notified: notifiedIds.length }), {
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