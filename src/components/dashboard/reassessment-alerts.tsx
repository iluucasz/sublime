import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CalendarClock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Row = {
  patient_id: string;
  patient_name: string;
  assessment_id: string;
  assessment_name: string;
  specialty_id: string | null;
  specialty_name: string | null;
  last_applied_at: string | null;
  interval_months: number;
  due_in_days: number; // negative = overdue
};

export function ReassessmentAlerts() {
  const { user, isRespTecnicoOrAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["reassessment-alerts", user?.id, isRespTecnicoOrAdmin],
    enabled: !!user,
    queryFn: async () => {
      // Load assessments + their applications + patients + therapy_grid (for professional filter)
      const [assessments, applications, patients, myProfile] = await Promise.all([
        supabase.from("assessments").select("id, name, specialty_id, reassessment_interval_months, specialties(name)"),
        supabase.from("assessment_applications").select("assessment_id, patient_id, applied_at").order("applied_at", { ascending: false }),
        supabase.from("patients").select("id, full_name, status"),
        isRespTecnicoOrAdmin
          ? Promise.resolve({ data: null })
          : supabase.from("professionals").select("id, specialty_id").eq("user_id", user!.id).maybeSingle(),
      ]);

      const activePatients = (patients.data ?? []).filter((p: any) => p.status === "ativo");
      const patientById = new Map(activePatients.map((p: any) => [p.id, p]));

      // Filter for "profissional": only own specialty + own patients in therapy_grid
      let allowedPairs: Set<string> | null = null; // key = `${assessment_id}|${patient_id}`
      let allowedAssessmentIds: Set<string> | null = null;
      if (!isRespTecnicoOrAdmin) {
        const prof: any = myProfile.data;
        if (!prof?.specialty_id) return [] as Row[];
        allowedAssessmentIds = new Set(
          (assessments.data ?? []).filter((a: any) => a.specialty_id === prof.specialty_id).map((a: any) => a.id),
        );
        const { data: grid } = await supabase
          .from("therapy_grid")
          .select("patient_id")
          .eq("professional_id", prof.id)
          .eq("specialty_id", prof.specialty_id);
        const myPatients = new Set((grid ?? []).map((g: any) => g.patient_id));
        allowedPairs = new Set();
        for (const aid of allowedAssessmentIds) {
          for (const pid of myPatients) allowedPairs.add(`${aid}|${pid}`);
        }
      }

      // Latest application per (assessment, patient)
      const latest = new Map<string, string>();
      for (const a of applications.data ?? []) {
        const key = `${(a as any).assessment_id}|${(a as any).patient_id}`;
        if (!latest.has(key)) latest.set(key, (a as any).applied_at);
      }

      const rows: Row[] = [];
      const now = Date.now();
      for (const assess of assessments.data ?? []) {
        const a: any = assess;
        if (allowedAssessmentIds && !allowedAssessmentIds.has(a.id)) continue;
        const intervalMonths = a.reassessment_interval_months ?? 3;
        for (const p of activePatients) {
          const pair = `${a.id}|${(p as any).id}`;
          if (allowedPairs && !allowedPairs.has(pair)) continue;
          const last = latest.get(pair) ?? null;
          if (!last) continue; // only alert reassessments for those who already did at least once
          const lastDate = new Date(last);
          const due = new Date(lastDate);
          due.setMonth(due.getMonth() + intervalMonths);
          const diffDays = Math.floor((due.getTime() - now) / (1000 * 60 * 60 * 24));
          if (diffDays > 30) continue; // only show within 30 days of due / overdue
          rows.push({
            patient_id: (p as any).id,
            patient_name: (p as any).full_name,
            assessment_id: a.id,
            assessment_name: a.name,
            specialty_id: a.specialty_id,
            specialty_name: a.specialties?.name ?? null,
            last_applied_at: last,
            interval_months: intervalMonths,
            due_in_days: diffDays,
          });
        }
      }
      rows.sort((x, y) => x.due_in_days - y.due_in_days);
      return rows;
    },
  });

  if (isLoading) return null;
  if (!data?.length) return null;

  const overdue = data.filter((r) => r.due_in_days < 0).length;

  return (
    <Card className="border-amber-300/60">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-600" />
              Reavaliações pendentes
            </CardTitle>
            <CardDescription>
              {isRespTecnicoOrAdmin
                ? "Todas as avaliações que precisam ser refeitas (intervalo padrão a cada 3 meses)."
                : "Suas avaliações da sua área que precisam ser refeitas."}
            </CardDescription>
          </div>
          {overdue > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {overdue} em atraso
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.slice(0, 12).map((r) => {
          const overdueRow = r.due_in_days < 0;
          return (
            <div
              key={`${r.assessment_id}-${r.patient_id}`}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 flex-wrap"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{r.patient_name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.assessment_name}
                  {r.specialty_name ? ` · ${r.specialty_name}` : ""} · última em{" "}
                  {r.last_applied_at ? new Date(r.last_applied_at).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={overdueRow ? "destructive" : "secondary"}>
                  {overdueRow ? `${Math.abs(r.due_in_days)} dias em atraso` : `vence em ${r.due_in_days} dias`}
                </Badge>
                <Button asChild size="sm" variant="outline">
                  <Link to="/assessments/$assessmentId" params={{ assessmentId: r.assessment_id }}>
                    Aplicar
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
        {data.length > 12 && (
          <p className="text-xs text-muted-foreground pt-1">+{data.length - 12} outras pendências…</p>
        )}
      </CardContent>
    </Card>
  );
}
