import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: roda toda segunda-feira. Só envia cobranças quando estamos
 * dentro da janela dos 2 meses finais do semestre (1º de maio em diante
 * para o 1º semestre; 1º de novembro em diante para o 2º semestre).
 * Para cada relatório do semestre corrente que ainda não foi aprovado pela
 * diretoria, identifica as especialidades da grade que não têm seção
 * preenchida e cria um anúncio "cobranca_relatorio" para o profissional
 * responsável (uma cobrança por (report, professional) por execução, com
 * deduplicação de 6 dias para não inundar o mural).
 */

function semesterWindow(today: Date) {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth(); // 0-11
  if (m <= 5) {
    // 1º semestre — janela: 1º mai a 30 jun
    return {
      period_start: `${y}-01-01`,
      period_end: `${y}-06-30`,
      window_start: new Date(Date.UTC(y, 4, 1)), // 1º de maio
      window_end: new Date(Date.UTC(y, 5, 30, 23, 59, 59)),
    };
  }
  return {
    period_start: `${y}-07-01`,
    period_end: `${y}-12-31`,
    window_start: new Date(Date.UTC(y, 10, 1)), // 1º de novembro
    window_end: new Date(Date.UTC(y, 11, 31, 23, 59, 59)),
  };
}

export const Route = createFileRoute("/api/public/hooks/cobranca-pendencias")({
  server: {
    handlers: {
      POST: async () => {
        const today = new Date();
        const { period_start, period_end, window_start, window_end } = semesterWindow(today);

        if (today < window_start || today > window_end) {
          return Response.json({
            skipped: true,
            reason: "fora da janela de cobrança (últimos 2 meses do semestre)",
            today: today.toISOString(),
            window_start: window_start.toISOString(),
            window_end: window_end.toISOString(),
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Relatórios abertos do semestre corrente
        const { data: reports, error: reportsErr } = await supabaseAdmin
          .from("reports")
          .select("id, patient_id, title, period_start, period_end, status")
          .gte("period_start", period_start)
          .lte("period_end", period_end)
          .not("status", "in", "(aprovado_diretoria,liberado_pais,assinado)");
        if (reportsErr) throw reportsErr;
        if (!reports?.length) return Response.json({ ok: true, sent: 0, reason: "sem relatórios abertos" });

        const reportIds = reports.map((r: any) => r.id);
        const patientIds = [...new Set(reports.map((r: any) => r.patient_id).filter(Boolean))];

        const [{ data: sections }, { data: grid }, { data: professionals }, { data: patients }] =
          await Promise.all([
            supabaseAdmin
              .from("report_sections")
              .select("report_id, specialty_id, content, field_values")
              .in("report_id", reportIds),
            supabaseAdmin
              .from("therapy_grid")
              .select("patient_id, specialty_id, professional_id")
              .in("patient_id", patientIds),
            supabaseAdmin.from("professionals").select("id, full_name, specialty_id"),
            supabaseAdmin.from("patients").select("id, full_name").in("id", patientIds),
          ]);

        const specNames = new Map<string, string>();
        const { data: specs } = await supabaseAdmin.from("specialties").select("id, name");
        (specs ?? []).forEach((s: any) => specNames.set(s.id, s.name));

        const patientName = new Map((patients ?? []).map((p: any) => [p.id, p.full_name]));
        const profById = new Map((professionals ?? []).map((p: any) => [p.id, p]));

        const sectionFilled = (sec: any) =>
          (sec.content && String(sec.content).trim().length > 0) ||
          (sec.field_values && Object.keys(sec.field_values).length > 0);

        // Dedup: já existe anúncio igual nos últimos 6 dias?
        const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabaseAdmin
          .from("announcements")
          .select("report_id, target_professional_id")
          .eq("kind", "cobranca_relatorio")
          .gte("created_at", sixDaysAgo)
          .in("report_id", reportIds);
        const recentKey = new Set(
          (recent ?? []).map((r: any) => `${r.report_id}::${r.target_professional_id}`),
        );

        const inserts: any[] = [];

        for (const r of reports as any[]) {
          const reportSections = (sections ?? []).filter((s: any) => s.report_id === r.id);
          const filledSpecs = new Set(
            reportSections.filter(sectionFilled).map((s: any) => s.specialty_id).filter(Boolean),
          );
          const gridRows = (grid ?? []).filter((g: any) => g.patient_id === r.patient_id);
          const seen = new Set<string>();
          for (const g of gridRows) {
            if (!g.specialty_id || seen.has(g.specialty_id)) continue;
            seen.add(g.specialty_id);
            if (filledSpecs.has(g.specialty_id)) continue;

            // resolve profissional: grade > primeiro ativo da especialidade
            let profId: string | null = g.professional_id ?? null;
            if (!profId) {
              const candidate = (professionals ?? []).find(
                (p: any) => p.specialty_id === g.specialty_id,
              );
              profId = candidate?.id ?? null;
            }
            if (!profId) continue;
            const key = `${r.id}::${profId}`;
            if (recentKey.has(key)) continue;
            recentKey.add(key);

            const specName = specNames.get(g.specialty_id) ?? "—";
            const pName = patientName.get(r.patient_id) ?? "—";
            inserts.push({
              author_id: null,
              author_role: "sistema",
              kind: "cobranca_relatorio",
              title: `Faltando: ${specName} — ${pName}`,
              body:
                `Cobrança automática: por favor, preencha sua seção (${specName}) ` +
                `do relatório de ${pName} (${r.title}). Estamos nos 2 meses finais do semestre.`,
              target_type: "professional",
              target_professional_id: profId,
              report_id: r.id,
              patient_id: r.patient_id,
            });
          }
        }

        if (!inserts.length) return Response.json({ ok: true, sent: 0 });

        const { error: insErr } = await supabaseAdmin.from("announcements").insert(inserts);
        if (insErr) throw insErr;

        return Response.json({ ok: true, sent: inserts.length });
      },
    },
  },
});
