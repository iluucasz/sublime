import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const METRIC_LABEL: Record<string, string> = {
  relatorios_no_prazo: "Relatórios no prazo",
  avaliacoes_realizadas: "Avaliações realizadas",
  admissoes_mes: "Admissões no mês",
  evolucao_positiva: "Evolução positiva",
  custom: "Indicador",
};

export function GoalsProgress({ unitId }: { unitId: string }) {
  const { data } = useQuery({
    queryKey: ["goals-progress", unitId],
    queryFn: async () => {
      const goalsQ = supabase.from("goals" as any).select("*").order("created_at", { ascending: false });
      const { data: goals } = await goalsQ;
      const filtered = (goals as any[] ?? []).filter((g) => !unitId || g.scope !== "unit" || g.unit_id === unitId);

      // Pré-cálculo: admissões neste mês (filtrado por unidade)
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const admQ = supabase.from("patients").select("id", { count: "exact", head: true }).gte("sublime_entry_date", monthStart);
      if (unitId) admQ.eq("unit_id", unitId);
      const admRes = await admQ;
      const admissoesMes = admRes.count ?? 0;

      // Relatórios criados nos últimos 30 dias
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const repRes = await supabase.from("reports").select("id", { count: "exact", head: true }).gte("created_at", since);

      return filtered.map((g) => {
        let actual = 0;
        if (g.metric_type === "admissoes_mes") actual = admissoesMes;
        else if (g.metric_type === "relatorios_no_prazo") actual = repRes.count ?? 0;
        return { ...g, actual };
      });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Metas e indicadores</CardTitle>
            <CardDescription>Acompanhamento do que foi definido pela diretoria</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline"><Link to="/goals">Gerenciar</Link></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data?.length && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma meta definida ainda. <Link to="/goals" className="text-primary underline">Criar primeira meta</Link>
          </p>
        )}
        {data?.map((g: any) => {
          const pct = g.target_value > 0 ? Math.min(100, Math.round((g.actual / g.target_value) * 100)) : 0;
          return (
            <div key={g.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{g.name}</span>
                <span className="text-muted-foreground">{g.actual} / {g.target_value}</span>
              </div>
              <Progress value={pct} />
              <div className="text-xs text-muted-foreground">{METRIC_LABEL[g.metric_type] ?? g.metric_type} · {g.period}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
