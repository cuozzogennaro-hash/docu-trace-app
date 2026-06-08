import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scale-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // Extract API key: header preferred, query param fallback
  const url = new URL(req.url);
  const headerKey = req.headers.get("x-scale-api-key");
  const queryKey =
    url.searchParams.get("api_key") ?? url.searchParams.get("scale_api_key");
  const apiKey = (headerKey ?? queryKey ?? "").trim();

  if (!apiKey || !UUID_RE.test(apiKey)) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Validate key + scale integration flag
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id, scale_integration_active")
    .eq("scale_api_key", apiKey)
    .maybeSingle();

  if (storeErr) {
    console.error("store lookup error", storeErr);
    return json({ error: "internal_error" }, 500);
  }
  if (!store || !store.scale_integration_active) {
    return json({ error: "unauthorized" }, 401);
  }

  // Atomic pull: UPDATE ... RETURNING marks rows processed and returns them in one query.
  const { data: rows, error: updErr } = await supabase
    .from("scales_queue")
    .update({ status: "processed" })
    .eq("store_id", store.id)
    .eq("status", "pending")
    .not("product_name", "is", null)
    .neq("product_name", "")
    .select(
      "plu_code, product_name, lot_number, ingredients, department_code, born_in, raised_in, slaughtered_in, slaughterhouse_cee, supplier_lot",
    );

  if (updErr) {
    console.error("queue pull error", updErr);
    return json({ error: "internal_error" }, 500);
  }

  return json(rows ?? [], 200);
});