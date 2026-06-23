import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, HeartPulse, Building2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import subliminho from "@/assets/subliminho.png";
import { PendingSignaturesAlert } from "@/components/signatures";
import { PendingProfessionalsAlert } from "@/components/pending-professionals-alert";
import { UnitFilter } from "@/components/dashboard/unit-filter";
import { ConferenceGrid } from "@/components/dashboard/conference-grid";
import { AnnouncementsFeed } from "@/components/dashboard/announcements-feed";
import { GoalsProgress } from "@/components/dashboard/goals-progress";
import { ReassessmentAlerts } from "@/components/dashboard/reassessment-alerts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel Geral — ACT Sublime" }] }),
  component: DashboardPage,
});

const COLORS = ["#2C2E6B", "#6BB6E3", "#F5C842", "#E55D87", "#F26B3A", "#9B72CF"];

function DashboardPage() {
  const [unitId, setUnitId] = useState("");

  const stats = useQuery({
    queryKey: ["dashboard-stats", unitId],
    queryFn: async () => {
      const patientsQ = supabase.from("patients").select("id, status, unit_id, sublime_entry_date, units(name)");
      if (unitId) patientsQ.eq("unit_id", unitId);
      const [patients, professionals, units, bySpec] = await Promise.all([
        patientsQ,
        supabase.from("professionals").select("id, status, unit_id"),
        supabase.from("units").select("id, name"),
        supabase.from("therapy_grid").select("specialty_id, patient_id, specialties(name, color), patients!inner(unit_id)"),
      ]);

      const activePatients = (patients.data ?? []).filter((p: any) => p.status === "ativo").length;
      const activePros = (professionals.data ?? []).filter((p: any) => p.status === "ativo" && (!unitId || p.unit_id === unitId)).length;

      const unitCounts = new Map<string, number>();
      (patients.data ?? []).filter((p: any) => p.status === "ativo").forEach((p: any) => {
        const n = p.units?.name ?? "Sem unidade";
        unitCounts.set(n, (unitCounts.get(n) ?? 0) + 1);
      });
      const unitData = Array.from(unitCounts, ([name, value]) => ({ name, value }));

      const specCounts = new Map<string, { name: string; value: number }>();
      (bySpec.data ?? []).forEach((g: any) => {
        if (unitId && g.patients?.unit_id !== unitId) return;
        const n = g.specialties?.name ?? "—";
        const cur = specCounts.get(n) ?? { name: n, value: 0 };
        cur.value += 1;
        specCounts.set(n, cur);
      });
      const specData = Array.from(specCounts.values());

      const months: Record<string, number> = {};
      (patients.data ?? []).forEach((p: any) => {
        const d = new Date(p.sublime_entry_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months[key] = (months[key] ?? 0) + 1;
      });
      const monthData = Object.entries(months).sort().slice(-12).map(([k, v]) => ({ month: k, admissoes: v }));

      return { activePatients, activePros, units: units.data?.length ?? 0, unitData, specData, monthData };
    },
  });

  const d = stats.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-primary">Painel Geral</h1>
          <p className="text-muted-foreground">Visão consolidada do ACT Sublime</p>
        </div>
        <div className="flex items-center gap-3">
          <UnitFilter value={unitId} onChange={setUnitId} />
          <img src={subliminho} alt="Subliminho" className="h-16 hidden md:block" />
        </div>
      </div>

      <PendingProfessionalsAlert />
      <PendingSignaturesAlert />
      <ReassessmentAlerts />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={HeartPulse} label="Pacientes ativos" value={d?.activePatients ?? "—"} accent="bg-[oklch(0.74_0.13_235)]/15 text-[oklch(0.4_0.13_235)]" />
        <StatCard icon={Users} label="Profissionais ativos" value={d?.activePros ?? "—"} accent="bg-[oklch(0.85_0.16_90)]/20 text-[oklch(0.45_0.13_85)]" />
        <StatCard icon={Building2} label="Unidades" value={d?.units ?? "—"} accent="bg-[oklch(0.66_0.18_5)]/15 text-[oklch(0.5_0.18_5)]" />
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3">Conferência</h2>
        <ConferenceGrid unitId={unitId} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnnouncementsFeed />
        <GoalsProgress unitId={unitId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pacientes por Unidade</CardTitle>
            <CardDescription>Distribuição de pacientes ativos</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {d?.unitData && d.unitData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.unitData}>
                  <XAxis dataKey="name" stroke="currentColor" fontSize={12} />
                  <YAxis stroke="currentColor" fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2C2E6B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pacientes por Especialidade</CardTitle>
            <CardDescription>Conforme grade terapêutica</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {d?.specData && d.specData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.specData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {d.specData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Admissões por mês</CardTitle>
          <CardDescription>Últimos 12 meses</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {d?.monthData && d.monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.monthData}>
                <XAxis dataKey="month" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="admissoes" fill="#E55D87" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-3xl font-bold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-sm gap-2">
      <img src={subliminho} alt="" className="h-24 opacity-60" />
      Sem dados ainda
    </div>
  );
}
