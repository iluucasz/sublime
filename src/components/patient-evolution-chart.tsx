import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3 } from "lucide-react";
import { isChartableField, type FormField } from "@/components/form-fields";

type Row = {
  field_id: string;
  label: string;
  date: string;
  value: number;
};

export function PatientEvolutionChart({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["patient-evolution", patientId],
    queryFn: async () => {
      const { data: reports, error: e1 } = await supabase
        .from("reports")
        .select("id, created_at, period_end, period_start")
        .eq("patient_id", patientId);
      if (e1) throw e1;
      const ids = (reports ?? []).map((r) => r.id);
      if (!ids.length) return [] as Row[];

      const { data: secs, error: e2 } = await supabase
        .from("report_sections")
        .select("report_id, fields, field_values")
        .in("report_id", ids);
      if (e2) throw e2;

      const dateById = new Map<string, string>(
        (reports ?? []).map((r: any) => [r.id, r.period_end ?? r.period_start ?? r.created_at]),
      );

      const rows: Row[] = [];
      for (const s of secs ?? []) {
        const fields: FormField[] = Array.isArray((s as any).fields) ? (s as any).fields : [];
        const values = ((s as any).field_values ?? {}) as Record<string, any>;
        for (const f of fields) {
          if (!isChartableField(f)) continue;
          const v = values[f.id];
          if (v === null || v === undefined || v === "") continue;
          const n = Number(v);
          if (Number.isNaN(n)) continue;
          rows.push({
            field_id: f.id,
            label: f.label,
            date: dateById.get((s as any).report_id) ?? "",
            value: n,
          });
        }
      }
      return rows;
    },
  });

  if (isLoading) return null;
  if (!data?.length) return null;

  // Group by label (so the same question across reports forms one line)
  const byLabel = new Map<string, Row[]>();
  for (const r of data) {
    if (!byLabel.has(r.label)) byLabel.set(r.label, []);
    byLabel.get(r.label)!.push(r);
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Evolução do paciente</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Gráficos automáticos para perguntas do tipo número ou escala, somando todos os relatórios deste paciente.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from(byLabel.entries()).map(([label, rows]) => {
          const chartData = rows
            .filter((r) => r.date)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((r) => ({ date: new Date(r.date).toLocaleDateString("pt-BR"), value: r.value }));
          if (chartData.length < 1) return null;
          return (
            <div key={label} className="space-y-1">
              <p className="text-sm font-medium">{label}</p>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} name={label} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
