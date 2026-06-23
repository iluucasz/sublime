import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-shell";
import { EditHistoryButton } from "@/components/edit-history";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Trash2, Check } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assessments/$assessmentId")({
  head: () => ({ meta: [{ title: "Avaliação — ACT Sublime" }] }),
  component: AssessmentDetail,
});

const SCORE_OPTIONS = [
  { value: 0, label: "0" },
  { value: 0.5, label: "½" },
  { value: 1, label: "1" },
];

function ScorePicker({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex rounded-md border overflow-hidden shrink-0">
      {SCORE_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "w-9 h-9 text-sm font-semibold transition-colors border-r last:border-r-0",
            value === o.value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AssessmentDetail() {
  const { assessmentId } = Route.useParams();
  const qc = useQueryClient();
  const { user, isRespTecnicoOrAdmin } = useAuth();

  const { data: assessment } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: async () => (await supabase.from("assessments").select("*").eq("id", assessmentId).single()).data,
  });

  const { data: items } = useQuery({
    queryKey: ["assessment_items", assessmentId],
    queryFn: async () =>
      (await supabase.from("assessment_items").select("*").eq("assessment_id", assessmentId).order("order_index")).data ?? [],
  });

  const { data: patients } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => (await supabase.from("patients").select("id, full_name").order("full_name")).data ?? [],
  });

  const { data: applications } = useQuery({
    queryKey: ["assessment_applications", assessmentId],
    queryFn: async () =>
      (await supabase
        .from("assessment_applications")
        .select("*, patients(full_name), assessment_results(item_id, score)")
        .eq("assessment_id", assessmentId)
        .order("applied_at", { ascending: false })).data ?? [],
  });

  const isMilestone = assessment?.score_mode === "milestone";

  // grupos por área (mantém ordem dos itens)
  const groups = useMemo(() => {
    const out: { label: string; items: any[] }[] = [];
    for (const it of items ?? []) {
      const label = it.group_label ?? "Itens";
      let g = out.find((x) => x.label === label);
      if (!g) { g = { label, items: [] }; out.push(g); }
      g.items.push(it);
    }
    return out;
  }, [items]);

  // ---- Item add (apenas liderança) ----
  const [itemForm, setItemForm] = useState({ name: "", max_score: "", group_label: "" });
  const addItem = useMutation({
    mutationFn: async () => {
      if (!itemForm.name) throw new Error("Nome do item obrigatório.");
      const order_index = items?.length ?? 0;
      const payload: any = { assessment_id: assessmentId, name: itemForm.name, order_index };
      if (itemForm.max_score) payload.max_score = Number(itemForm.max_score);
      if (itemForm.group_label) payload.group_label = itemForm.group_label;
      const { error } = await supabase.from("assessment_items").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado.");
      qc.invalidateQueries({ queryKey: ["assessment_items", assessmentId] });
      setItemForm({ name: "", max_score: "", group_label: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assessment_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment_items", assessmentId] }),
  });

  // ---- Responder (nova aplicação) ----
  const [patientId, setPatientId] = useState("");
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});

  const total = useMemo(() => Object.values(scores).reduce((a, b) => a + b, 0), [scores]);
  const groupSubtotal = (g: { items: any[] }) => g.items.reduce((s, it) => s + (scores[it.id] ?? 0), 0);

  const createApplication = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error("Selecione o paciente.");
      const answered = (items ?? []).filter((it: any) => scores[it.id] !== undefined);
      if (!answered.length) throw new Error("Pontue ao menos um item.");
      const { data: app, error } = await supabase
        .from("assessment_applications")
        .insert({ assessment_id: assessmentId, patient_id: patientId, applied_at: appliedAt, notes: notes || null, applied_by: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      const rows = answered.map((it: any) => ({ application_id: app.id, item_id: it.id, score: scores[it.id] }));
      const { error: e2 } = await supabase.from("assessment_results").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Aplicação registrada.");
      qc.invalidateQueries({ queryKey: ["assessment_applications", assessmentId] });
      setPatientId(""); setNotes(""); setScores({}); setAppliedAt(new Date().toISOString().slice(0, 10));
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Evolução ----
  const [chartPatient, setChartPatient] = useState<string>("");
  const groupNames = useMemo(() => groups.map((g) => g.label), [groups]);
  const itemGroup = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of groups) for (const it of g.items) m[it.id] = g.label;
    return m;
  }, [groups]);

  const chartData = useMemo(() => {
    if (!chartPatient || !applications) return [];
    return applications
      .filter((a: any) => a.patient_id === chartPatient)
      .slice()
      .sort((a: any, b: any) => a.applied_at.localeCompare(b.applied_at))
      .map((a: any) => {
        const row: any = { date: new Date(a.applied_at).toLocaleDateString("pt-BR") };
        if (isMilestone) {
          for (const gl of groupNames) row[gl] = 0;
          for (const r of a.assessment_results ?? []) {
            const gl = itemGroup[r.item_id];
            if (gl != null && r.score != null) row[gl] += Number(r.score);
          }
        } else {
          for (const it of items ?? []) {
            const r = a.assessment_results?.find((rr: any) => rr.item_id === it.id);
            if (r?.score != null) row[it.name] = Number(r.score);
          }
        }
        return row;
      });
  }, [chartPatient, applications, items, isMilestone, groupNames, itemGroup]);

  const chartKeys = isMilestone ? groupNames : (items ?? []).map((it: any) => it.name);
  const colors = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#a855f7", "#ef4444", "#14b8a6", "#8b5cf6", "#f97316", "#0ea5e9", "#84cc16", "#e11d48"];

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/assessments"><ArrowLeft className="h-4 w-4 mr-1" /> Avaliações</Link>
      </Button>
      <PageHeader
        title={assessment?.name ?? "Avaliação"}
        description={assessment?.description ?? undefined}
        action={isRespTecnicoOrAdmin ? <EditHistoryButton entityType="assessment" entityId={assessmentId} includeChildren /> : undefined}
      />

      <Tabs defaultValue="answer">
        <TabsList>
          <TabsTrigger value="answer">Responder</TabsTrigger>
          <TabsTrigger value="apps">Aplicações</TabsTrigger>
          <TabsTrigger value="chart">Evolução</TabsTrigger>
          {isRespTecnicoOrAdmin && <TabsTrigger value="items">Itens (modelo)</TabsTrigger>}
        </TabsList>

        {/* RESPONDER */}
        <TabsContent value="answer">
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Paciente *</Label>
                <Select value={patientId} onValueChange={setPatientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {patients?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data da aplicação</Label>
                <Input type="date" value={appliedAt} onChange={(e) => setAppliedAt(e.target.value)} />
              </div>
            </div>

            {isMilestone && (
              <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm sticky top-0 z-10">
                <span className="text-muted-foreground">0 = não atingiu · ½ = parcial · 1 = atingiu</span>
                <span className="font-semibold text-primary">Total: {total} / {items?.length ?? 0}</span>
              </div>
            )}

            {!items?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Esta avaliação ainda não tem itens.</p>
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <div key={g.label} className="space-y-1.5">
                    <div className="flex items-center justify-between border-b pb-1">
                      <h3 className="font-semibold text-sm text-primary">{g.label}</h3>
                      {isMilestone && (
                        <span className="text-xs font-medium text-muted-foreground">{groupSubtotal(g)} / {g.items.length}</span>
                      )}
                    </div>
                    {g.items.map((it: any, idx: number) => {
                      // Se o nome do item já começa com sua própria numeração (ex.: "1. ..."),
                      // não exibimos o número automático para evitar duplicidade.
                      const hasOwnNumber = /^\s*\d+\.\s/.test(it.name ?? "");
                      return (
                      <div key={it.id} className="flex items-start gap-3 py-1">
                        <span className="text-xs text-muted-foreground w-5 pt-2 shrink-0">{hasOwnNumber ? "" : `${idx + 1}.`}</span>
                        <span className="flex-1 text-sm pt-1.5">{it.name}</span>

                        {isMilestone ? (
                          <ScorePicker value={scores[it.id]} onChange={(v) => setScores({ ...scores, [it.id]: v })} />
                        ) : (
                          <Input
                            type="number"
                            className="w-24"
                            value={scores[it.id] ?? ""}
                            onChange={(e) => setScores({ ...scores, [it.id]: Number(e.target.value) })}
                          />
                        )}
                      </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações da aplicação (opcional)" />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => createApplication.mutate()} disabled={createApplication.isPending}>
                <Check className="h-4 w-4 mr-1" /> {createApplication.isPending ? "Salvando…" : "Salvar aplicação"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* APLICAÇÕES */}
        <TabsContent value="apps">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Pontuação</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications?.map((a: any) => {
                  const sum = (a.assessment_results ?? []).reduce((s: number, r: any) => s + (r.score != null ? Number(r.score) : 0), 0);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{new Date(a.applied_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{a.patients?.full_name}</TableCell>
                      <TableCell>{isMilestone ? `${sum} / ${items?.length ?? 0}` : `${a.assessment_results?.length ?? 0} itens`}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md">{a.notes ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {!applications?.length && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma aplicação ainda.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* EVOLUÇÃO */}
        <TabsContent value="chart">
          <Card className="p-4 space-y-4">
            <div className="max-w-md">
              <Label>Paciente</Label>
              <Select value={chartPatient} onValueChange={setChartPatient}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {patients?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {chartData.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                {chartPatient ? "Sem aplicações para este paciente." : "Selecione um paciente para ver a evolução."}
              </div>
            ) : (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {chartKeys.map((k: string, idx: number) => (
                      <Line key={k} type="monotone" dataKey={k} stroke={colors[idx % colors.length]} strokeWidth={2} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ITENS (MODELO) — apenas liderança */}
        {isRespTecnicoOrAdmin && (
          <TabsContent value="items">
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
                <div>
                  <Label>Novo item</Label>
                  <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Descrição do item" />
                </div>
                <div>
                  <Label>Área / grupo</Label>
                  <Input value={itemForm.group_label} onChange={(e) => setItemForm({ ...itemForm, group_label: e.target.value })} placeholder="Ex.: Imitação Motora" />
                </div>
                <div>
                  <Label>Pontuação máx.</Label>
                  <Input type="number" value={itemForm.max_score} onChange={(e) => setItemForm({ ...itemForm, max_score: e.target.value })} />
                </div>
                <Button onClick={() => addItem.mutate()} disabled={addItem.isPending}>Adicionar</Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Máx.</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((it: any, i: number) => (
                    <TableRow key={it.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{it.group_label ?? "—"}</TableCell>
                      <TableCell className="text-sm">{it.name}</TableCell>
                      <TableCell>{it.max_score ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => removeItem.mutate(it.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!items?.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum item ainda.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
