import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, FileWarning, UserX, ClipboardList, Activity, ChevronRight } from "lucide-react";
import { isChartableField, type FormField } from "@/components/form-fields";

type Props = { unitId: string };

// Janela esperada (em meses) por tipo de relatório
const WINDOW: Record<string, number> = {
  "Relatório anual": 12,
  "Relatório 1º semestre": 6,
  "Relatório 2º semestre": 6,
  "Relatório 1º trimestre": 3,
  "Relatório 2º trimestre": 3,
  "Relatório 3º trimestre": 3,
  "Relatório 4º trimestre": 3,
};

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function ConferenceGrid({ unitId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["conference-overview", unitId],
    queryFn: async () => {
      const now = new Date();

      const patientsQ = supabase.from("patients").select("id, full_name, unit_id, units(name)").eq("status", "ativo");
      if (unitId) patientsQ.eq("unit_id", unitId);
      const patientsRes = await patientsQ;
      const patients = patientsRes.data ?? [];
      const patientIds = patients.map((p: any) => p.id);

      const [reportsRes, gridRes, sectionsRes, assessmentsRes, templatesRes] = await Promise.all([
        patientIds.length
          ? supabase.from("reports").select("id, patient_id, title, status, created_at, updated_at").in("patient_id", patientIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        patientIds.length
          ? supabase.from("therapy_grid").select("patient_id, professional_id, professionals(full_name, user_id)").in("patient_id", patientIds)
          : Promise.resolve({ data: [] as any[] }),
        Promise.resolve({ data: [] as any[] }),
        patientIds.length
          ? supabase.from("assessment_applications").select("patient_id, applied_at").in("patient_id", patientIds).order("applied_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("report_template_modules").select("fields"),
      ]);

      const reports = (reportsRes as any).data ?? [];
      const grid = (gridRes as any).data ?? [];
      const lastAssessment = new Map<string, Date>();
      for (const a of (assessmentsRes as any).data ?? []) {
        const d = new Date(a.applied_at);
        const cur = lastAssessment.get(a.patient_id);
        if (!cur || d > cur) lastAssessment.set(a.patient_id, d);
      }

      // Último relatório por paciente
      const lastReportByPatient = new Map<string, any>();
      for (const r of reports) {
        if (!lastReportByPatient.has(r.patient_id)) lastReportByPatient.set(r.patient_id, r);
      }

      // 1. Relatórios pendentes (paciente sem relatório no período esperado)
      const reportsPending: any[] = [];
      const reportsExpiring: any[] = [];
      for (const p of patients) {
        const last = lastReportByPatient.get(p.id);
        if (!last) {
          reportsPending.push({ patient: p, reason: "Sem relatório registrado" });
          continue;
        }
        const w = WINDOW[last.title] ?? 6;
        const elapsed = monthsBetween(new Date(last.created_at), now);
        if (elapsed >= w) {
          reportsPending.push({ patient: p, reason: `Último: ${last.title} há ${elapsed} meses`, last });
        } else if (elapsed >= w - 1) {
          reportsExpiring.push({ patient: p, last, monthsLeft: w - elapsed });
        }
        // Rascunho/revisão há mais de 15 dias
        if (last.status === "rascunho" || last.status === "em_revisao") {
          const days = Math.floor((+now - +new Date(last.updated_at)) / (1000 * 60 * 60 * 24));
          if (days >= 15) reportsExpiring.push({ patient: p, last, stalled: days });
        }
      }

      // 2. Profissionais com seção pendente (grade x relatório aberto)
      const openReports = reports.filter((r: any) => r.status === "rascunho" || r.status === "em_revisao");
      const profsPending: any[] = [];
      if (openReports.length) {
        const openIds = openReports.map((r: any) => r.id);
        const secRes = await supabase.from("report_sections").select("report_id, professional_id").in("report_id", openIds);
        const filled = new Set((secRes.data ?? []).map((s: any) => `${s.report_id}:${s.professional_id}`));
        for (const r of openReports) {
          const profs = grid.filter((g: any) => g.patient_id === r.patient_id);
          for (const g of profs) {
            if (!g.professional_id) continue;
            if (!filled.has(`${r.id}:${g.professional_id}`)) {
              const patient = patients.find((p: any) => p.id === r.patient_id);
              profsPending.push({
                report: r,
                patient,
                professional: g.professionals,
                professional_id: g.professional_id,
              });
            }
          }
        }
      }

      // 3. Avaliações pendentes (sem aplicação no semestre atual)
      const semesterStart = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
      const assessmentsPending = patients
        .map((p: any) => ({ patient: p, last: lastAssessment.get(p.id) }))
        .filter((x: any) => !x.last || x.last < semesterStart);

      // 4. Estudos de caso abertos
      const caseQ = supabase.from("case_studies" as any).select("*, patients(full_name, unit_id)").eq("status", "aberto").order("created_at", { ascending: false });
      const caseRes = await caseQ;
      let caseStudies = (caseRes as any).data ?? [];
      if (unitId) caseStudies = caseStudies.filter((c: any) => c.patients?.unit_id === unitId);

      // 5. Detectar evolução abaixo da meta (cria/atualiza case_studies automaticamente)
      // Coleta campos com min_target
      const targets = new Map<string, { label: string; target: number }>();
      for (const m of (templatesRes.data ?? []) as any[]) {
        const fields: FormField[] = Array.isArray(m.fields) ? m.fields : [];
        for (const f of fields) {
          if (isChartableField(f) && typeof f.min_target === "number") {
            targets.set(f.id, { label: f.label, target: f.min_target });
          }
        }
      }
      if (targets.size && patientIds.length) {
        const allSec = await supabase
          .from("report_sections")
          .select("field_values, report_id, reports!inner(patient_id, created_at)")
          .in("reports.patient_id", patientIds)
          .order("created_at", { foreignTable: "reports", ascending: false });
        // último valor por paciente x field
        const latest = new Map<string, { value: number; patient_id: string }>();
        for (const s of (allSec.data ?? []) as any[]) {
          const fv = (s.field_values ?? {}) as Record<string, any>;
          const pid = s.reports?.patient_id;
          if (!pid) continue;
          for (const [fid, val] of Object.entries(fv)) {
            const num = Number(val);
            if (!targets.has(fid) || Number.isNaN(num)) continue;
            const key = `${pid}:${fid}`;
            if (!latest.has(key)) latest.set(key, { value: num, patient_id: pid });
          }
        }
        // verifica abaixo da meta
        const existingKeys = new Set(
          caseStudies.map((c: any) => `${c.patient_id}:${c.triggered_by_field}`),
        );
        for (const [key, info] of latest) {
          const [pid, fid] = key.split(":");
          const t = targets.get(fid)!;
          if (info.value < t.target && !existingKeys.has(key)) {
            await supabase.from("case_studies" as any).insert({
              patient_id: pid,
              triggered_by_field: fid,
              field_label: t.label,
              last_value: info.value,
              min_target: t.target,
              status: "aberto",
            });
          }
        }
        // Re-fetch
        const caseRes2 = await supabase.from("case_studies" as any).select("*, patients(full_name, unit_id)").eq("status", "aberto").order("created_at", { ascending: false });
        caseStudies = ((caseRes2 as any).data ?? []) as any[];
        if (unitId) caseStudies = caseStudies.filter((c: any) => c.patients?.unit_id === unitId);
      }

      return {
        reportsPending,
        reportsExpiring,
        profsPending,
        assessmentsPending,
        caseStudies,
      };
    },
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <Card><CardContent className="p-6 text-muted-foreground">Calculando conferência…</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AlertCard
        title="Relatórios pendentes"
        icon={FileWarning}
        color="text-[oklch(0.55_0.2_30)]"
        count={data?.reportsPending.length ?? 0}
        description="Pacientes que precisam de novo relatório"
        items={data?.reportsPending.slice(0, 8).map((x: any) => ({
          key: x.patient.id,
          primary: x.patient.full_name,
          secondary: x.reason,
          to: x.last ? `/reports/${x.last.id}` : `/patients`,
        })) ?? []}
      />
      <AlertCard
        title="Vencendo / parados"
        icon={AlertTriangle}
        color="text-[oklch(0.6_0.18_85)]"
        count={data?.reportsExpiring.length ?? 0}
        description="Próximos do prazo ou parados há mais de 15 dias"
        items={data?.reportsExpiring.slice(0, 8).map((x: any, i: number) => ({
          key: `${x.patient.id}-${i}`,
          primary: x.patient.full_name,
          secondary: x.stalled ? `Parado há ${x.stalled} dias` : `${x.monthsLeft} meses até vencer`,
          to: `/reports/${x.last.id}`,
        })) ?? []}
      />
      <AlertCard
        title="Seções pendentes (profissionais)"
        icon={UserX}
        color="text-[oklch(0.5_0.2_300)]"
        count={data?.profsPending.length ?? 0}
        description="Profissionais que ainda não preencheram a seção"
        items={data?.profsPending.slice(0, 8).map((x: any, i: number) => ({
          key: `${x.report.id}-${x.professional_id}-${i}`,
          primary: x.professional?.full_name ?? "—",
          secondary: `${x.patient?.full_name} · ${x.report.title}`,
          to: `/reports/${x.report.id}`,
        })) ?? []}
      />
      <AlertCard
        title="Avaliações pendentes"
        icon={ClipboardList}
        color="text-[oklch(0.55_0.15_220)]"
        count={data?.assessmentsPending.length ?? 0}
        description="Pacientes sem aplicação de avaliação no semestre"
        items={data?.assessmentsPending.slice(0, 8).map((x: any) => ({
          key: x.patient.id,
          primary: x.patient.full_name,
          secondary: x.last ? `Última: ${x.last.toLocaleDateString("pt-BR")}` : "Nenhuma aplicação",
          to: `/assessments`,
        })) ?? []}
      />
      <AlertCard
        title="Estudos de caso"
        icon={Activity}
        color="text-destructive"
        count={data?.caseStudies.length ?? 0}
        description="Alertas automáticos: evolução abaixo da meta"
        items={data?.caseStudies.slice(0, 8).map((c: any) => ({
          key: c.id,
          primary: c.patients?.full_name ?? "—",
          secondary: `${c.field_label}: ${c.last_value} (meta ${c.min_target})`,
          to: `/reports`,
        })) ?? []}
      />
    </div>
  );
}

function AlertCard({
  title,
  icon: Icon,
  color,
  count,
  description,
  items,
}: {
  title: string;
  icon: any;
  color: string;
  count: number;
  description: string;
  items: { key: string; primary: string; secondary: string; to: string }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} /> {title}
          </CardTitle>
          <Badge variant={count > 0 ? "destructive" : "secondary"}>{count}</Badge>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">Tudo em dia.</p>
        ) : (
          items.map((it) => (
            <Button key={it.key} asChild variant="ghost" size="sm" className="w-full justify-between h-auto py-2">
              <Link to={it.to}>
                <span className="text-left">
                  <div className="text-sm font-medium truncate">{it.primary}</div>
                  <div className="text-xs text-muted-foreground truncate">{it.secondary}</div>
                </span>
                <ChevronRight className="h-3 w-3 shrink-0" />
              </Link>
            </Button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
