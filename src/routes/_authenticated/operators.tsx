import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, NewItemDialog, NewButton } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/operators")({
  head: () => ({ meta: [{ title: "Operadores — ACT Sublime" }] }),
  component: OperatorsPage,
});

function OperatorsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role_title: "", cargo: "", user_id: "", unit_id: "", admission_date: new Date().toISOString().slice(0, 10) });

  const { data, isLoading } = useQuery({
    queryKey: ["operators"],
    queryFn: async () => (await supabase.from("operators").select("*, units(name)").order("full_name")).data ?? [],
  });
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => (await supabase.from("units").select("*").order("name")).data ?? [],
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").order("full_name")).data ?? [],
    enabled: isAdmin,
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!payload.unit_id) delete payload.unit_id;
      if (!payload.user_id) delete payload.user_id;
      if (!payload.cargo) delete payload.cargo;
      const { error } = await supabase.from("operators").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Operador cadastrado");
      qc.invalidateQueries({ queryKey: ["operators"] });
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", role_title: "", cargo: "", user_id: "", unit_id: "", admission_date: new Date().toISOString().slice(0, 10) });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const CARGOS = [
    { v: "diretoria", l: "Diretoria" },
    { v: "responsavel_tecnico", l: "Responsável Técnico" },
    { v: "profissional_lideranca", l: "Profissional de Liderança" },
    { v: "profissional", l: "Profissional" },
  ];
  const cargoLabel = (v?: string | null) => CARGOS.find((c) => c.v === v)?.l ?? "—";

  return (
    <div>
      <PageHeader
        title="Operadores"
        description="Equipe administrativa do Grupo Sublime"
        action={isAdmin && <NewButton onClick={() => setOpen(true)} label="Novo operador" />}
      />
      <NewItemDialog title="Novo operador" open={open} onOpenChange={setOpen} onSubmit={() => create.mutateAsync()} submitting={create.isPending}>
        <div className="space-y-2"><Label>Nome completo *</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Função</Label><Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Ex: Recepcionista" /></div>
          <div className="space-y-2">
            <Label>Cargo (permissão) *</Label>
            <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CARGOS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vincular usuário</Label>
            <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {profiles?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">O cargo define automaticamente as permissões do usuário vinculado.</p>
        <div className="space-y-2"><Label>Admissão *</Label><Input type="date" required value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} /></div>
      </NewItemDialog>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="Nenhum operador cadastrado" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Função</TableHead><TableHead>Unidade</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.full_name}</TableCell>
                  <TableCell><Badge variant="outline">{cargoLabel(o.cargo)}</Badge></TableCell>
                  <TableCell>{o.role_title ?? "—"}</TableCell>
                  <TableCell>{o.units?.name ?? "—"}</TableCell>
                  <TableCell>
                    {o.status === "ativo"
                      ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Ativo</Badge>
                      : <Badge variant="outline">Desligado</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
