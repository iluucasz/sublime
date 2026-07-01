// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { childName, period, sections, tone, sessions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    const summary = (sessions ?? [])
      .slice(0, 30)
      .map(
        (s: any) =>
          `- ${s.session_date} | ${s.professional_name} (${s.professional_role ?? ""}) | humor: ${s.mood ?? "—"} | áreas: ${(s.skills ?? []).join(", ")} | obs: ${s.observations ?? ""} | atividades: ${s.activities ?? ""} | recado: ${s.message_to_parents ?? ""} | estrelas: ${JSON.stringify(s.ratings ?? {})}`
      )
      .join("\n");

    const prompt = `Você é um assistente para profissionais que atendem crianças com TEA. Gere um relatório em português do Brasil para os pais sobre ${childName}.
Período: ${period}.
Tom: ${tone}.
Inclua APENAS estas seções (com títulos em negrito markdown): ${sections.join(", ")}.
Use linguagem clara, acolhedora e sem jargão excessivo. Cite áreas trabalhadas e exemplos específicos das sessões.
Sessões disponíveis:
${summary || "(sem sessões registradas)"}
`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você gera relatórios terapêuticos para pais de crianças com TEA." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!r.ok) {
      if (r.status === 429)
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (r.status === 402)
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Settings > Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await r.text();
      console.error("AI error", r.status, t);
      return new Response(JSON.stringify({ error: "Erro na IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
