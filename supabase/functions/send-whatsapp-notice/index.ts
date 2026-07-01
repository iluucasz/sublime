import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11 && !digits.startsWith("55")) return "55" + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const INSTANCE_TOKEN = Deno.env.get("ZAPI_INSTANCE_TOKEN");
    const CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!INSTANCE_ID || !INSTANCE_TOKEN || !CLIENT_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Z-API não configurada. Defina ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { notice_ids } = await req.json();
    if (!Array.isArray(notice_ids) || notice_ids.length === 0) {
      return new Response(JSON.stringify({ error: "notice_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: notices } = await supabase
      .from("dd_notices")
      .select("id, title, message, patient_id, dd_patients!inner(parent_user_id)")
      .in("id", notice_ids);

    if (!notices) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;

    let sent = 0;
    const errors: any[] = [];

    for (const n of notices as any[]) {
      const parentId = n.dd_patients?.parent_user_id;
      if (!parentId) continue;

      // O WhatsApp do responsável fica em dd_members (schema consolidado).
      const { data: member } = await supabase
        .from("dd_members")
        .select("whatsapp")
        .eq("user_id", parentId)
        .maybeSingle();

      const phone = normalizePhone(member?.whatsapp || "");
      if (!phone) {
        await supabase.from("dd_notices").update({ whatsapp_status: "no_phone" }).eq("id", n.id);
        continue;
      }

      const message = `*${n.title}*\n\n${n.message}\n\n---\n*ATENÇÃO!* Por favor não responder essa mensagem por esse canal.\nGrupo Sublime - www.sublimegrupo.com.br\nWhatsApp: 21 98668-0771`;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": CLIENT_TOKEN,
          },
          body: JSON.stringify({ phone, message }),
        });
        const text = await res.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch { /* not json */ }

        console.log("z-api response", { id: n.id, phone, http: res.status, body: text });

        const hasError = parsed && (parsed.error || parsed.value === false);
        const hasSuccessId = parsed && (parsed.messageId || parsed.zaapId || parsed.id);
        const ok = res.ok && !hasError && hasSuccessId;

        let status: string;
        if (ok) status = "sent";
        else if (!res.ok) status = `error_${res.status}`;
        else status = `error_${(parsed?.error || parsed?.message || "unknown").toString().slice(0, 80)}`;

        if (!ok) {
          console.error("z-api send failed", { id: n.id, http: res.status, body: text });
          errors.push({ id: n.id, http: res.status, body: parsed ?? text });
        }
        await supabase.from("dd_notices").update({ whatsapp_status: status }).eq("id", n.id);
        if (ok) sent++;
      } catch (err: any) {
        console.error("z-api fetch failed", err);
        await supabase.from("dd_notices").update({ whatsapp_status: "error_network" }).eq("id", n.id);
        errors.push({ id: n.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ sent, total: notices.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("whatsapp error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
