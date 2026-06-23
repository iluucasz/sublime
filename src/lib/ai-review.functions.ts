import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const reviewSectionWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { content: string; sectionTitle?: string; specialty?: string }) => {
    if (!input || typeof input.content !== "string") throw new Error("Conteúdo inválido.");
    if (input.content.length < 5) throw new Error("Texto muito curto para revisar.");
    if (input.content.length > 20000) throw new Error("Texto muito longo (máx 20k).");
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const systemPrompt = `Você é um revisor clínico especializado em relatórios terapêuticos da clínica Sublime (acompanhamento transdisciplinar de crianças com TEA e neurodivergências).

Sua tarefa: revisar o texto fornecido pelo profissional, melhorando:
- Concordância verbal e nominal em português brasileiro
- Clareza, fluidez e coesão
- Formatação em parágrafos bem estruturados
- Tom profissional, técnico e respeitoso (linguagem para pais e equipe multidisciplinar)
- Correção ortográfica
- Padronização de termos clínicos

NÃO altere informações factuais, números, datas, nomes ou diagnósticos. NÃO invente conteúdo novo. Mantenha a essência e os dados do texto original. Devolva APENAS o texto revisado, sem comentários, sem markdown extra, sem prefixos como "Texto revisado:".`;

    const userPrompt = `${data.sectionTitle ? `Seção: ${data.sectionTitle}\n` : ""}${data.specialty ? `Área: ${data.specialty}\n` : ""}
Texto a revisar:

${data.content}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos em Lovable AI.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Erro da IA: ${res.status} ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const reviewed: string = json?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!reviewed) throw new Error("A IA não retornou conteúdo.");
    return { reviewed };
  });
