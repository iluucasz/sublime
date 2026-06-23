import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, NewItemDialog, NewButton, EmptyState } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Metas — ACT Sublime" }] }),
  component: GoalsPage,
});

const METRICS = [
  { value: "relatorios_no_prazo", label: "Relatórios no prazo (últimos 30 dias)" },
  { value: "avaliacoes_realizadas", label: "Avaliações realizadas" },
  { value: "admissoes_mes", label: "Admissões no mês" },
  { value: "evolucao_positiva", label: "Evolução positiva (estudos de caso)" },
  { value: "custom", label: "Personalizado" },
];

const PERIODS = ["mes", "trimestre", "semestre", "ano"];

function GoalsPage() {
  const qc = useQueryClient();
  const { user, isRespTecnicoOrAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    scope: "global",
    unit_id: "",
    name: "",
    description: "",
    metric_type: "relatorios_no_prazo",
    target_value: 10,
    period: "mes",
  });

  const { data: goals } = useQuery({
    queryKey: ["goals-list"],
    queryFn: async () => ((await supabase.from("goals" as any).select("*, units(name)").order("created_at", { ascending: false })).data ?? []) as any[],
  });
  const { data: units } = useQuery({
    queryKey: ["units-min"],
    queryFn: async () => (await supabase.from("units").select("id, name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Nome é obrigatório.");
      const payload: any = {
        scope: form.scope,
        unit_id: form.scope === "unit" ? form.unit_id || null : null,
        name: form.name,
        description: form.description || null,
        metric_type: form.metric_type,
        target_value: form.target_value,
        period: form.period,
        created_by: user?.id,
      };
      const { error } = await supabase.from("goals" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta criada.");
      qc.invalidateQueries({ queryKey: ["goals-list"] });
      qc.invalidateQueries({ queryKey: ["goals-progress"] });
      setOpen(false);
      setForm({ ...form, name: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals-list"] }),
  });

  return (
    <div>
      <PageHeader
        title="Metas e indicadores"
        description="Definidas pela diretoria e visíveis para toda a equipe."
        action={isRespTecnicoOrAdmin ? <NewButton onClick={() => setOpen(true)} label="Nova meta" /> : undefined}
      />

      <Card>
        {!goals?.length ? (
          <EmptyState title="Nenhuma meta ainda" description="Crie a primeira meta para acompanhar indicadores no painel." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((g: any) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{METRICS.find((m) => m.value === g.metric_type)?.label ?? g.metric_type}</TableCell>
                  <TableCell>{g.target_value}</TableCell>
                  <TableCell>{g.period}</TableCell>
                  <TableCell className="text-sm">{g.scope === "global" ? "Global" : g.units?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {isRespTecnicoOrAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(g.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <NewItemDialog title="Nova meta" open={open} onOpenChange={setOpen} submitting={create.isPending} onSubmit={() => create.mutate()}>
        <div>
          <Label>Nome *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: 20 relatórios no mês" />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Métrica</Label>
            <Select value={form.metric_type} onValueChange={(v) => setForm({ ...form, metric_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor-alvo</Label>
            <Input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Período</Label>
            <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Escopo</Label>
            <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="unit">Por unidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.scope === "unit" && (
          <div>
            <Label>Unidade</Label>
            <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {units?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </NewItemDialog>
    </div>
  );
}
