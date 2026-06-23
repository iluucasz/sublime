import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, NewItemDialog, NewButton } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, Pencil, CalendarClock, Upload, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImportGradesDialog } from "@/components/import-grades-dialog";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/patients/")({
  head: () => ({ meta: [{ title: "Pacientes — ACT Sublime" }] }),
  component: PatientsPage,
});

function ageFrom(date?: string | null) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

const emptyForm = {
  full_name: "",
  birth_date: "",
  sublime_entry_date: new Date().toISOString().slice(0, 10),
  unit_id: "",
  main_diagnosis: "",
  guardian_name: "",
  guardian_phone: "",
  notes: "",
};

function PatientsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*, units(name), patient_documents(id, doc_type, expires_at)")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => (await supabase.from("units").select("*").order("name")).data ?? [],
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!payload.unit_id) payload.unit_id = null;
      if (!payload.birth_date) payload.birth_date = null;
      if (editing) {
        const { error } = await supabase.from("patients").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("patients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Paciente atualizado" : "Paciente cadastrado");
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (p: any) => {
    setEditing(p);
    setForm({
      full_name: p.full_name ?? "",
      birth_date: p.birth_date ?? "",
      sublime_entry_date: p.sublime_entry_date ?? new Date().toISOString().slice(0, 10),
      unit_id: p.unit_id ?? "",
      main_diagnosis: p.main_diagnosis ?? "",
      guardian_name: p.guardian_name ?? "",
      guardian_phone: p.guardian_phone ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const isExpiring = (docs: any[] | null) => {
    if (!docs || docs.length === 0) return "no-doc";
    const soonest = docs
      .filter((d) => d.expires_at)
      .map((d) => new Date(d.expires_at))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (!soonest) return "ok";
    const days = Math.ceil((soonest.getTime() - Date.now()) / 86400000);
    if (days < 0) return "expired";
    if (days <= 30) return "warning";
    return "ok";
  };

  return (
    <div>
      <PageHeader
        title="Pacientes"
        description="Crianças e adolescentes em acompanhamento"
        action={isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar grades
            </Button>
            <NewButton onClick={startCreate} label="Novo paciente" />
          </div>
        )}
      />
      <ImportGradesDialog open={importOpen} onOpenChange={setImportOpen} />
      <NewItemDialog
        title={editing ? `Editar paciente — ${editing.full_name}` : "Novo paciente"}
        open={open}
        onOpenChange={(o) => { if (!o) { setOpen(false); setEditing(null); } else setOpen(true); }}
        onSubmit={() => upsertMutation.mutateAsync()}
        submitting={upsertMutation.isPending}
      >
        <div className="space-y-2"><Label>Nome completo *</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
          <div className="space-y-2"><Label>Entrada na Sublime *</Label><Input type="date" required value={form.sublime_entry_date} onChange={(e) => setForm({ ...form, sublime_entry_date: e.target.value })} /></div>
        </div>
        <div className="space-y-2">
          <Label>Unidade</Label>
          <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Diagnóstico / CID</Label><Input value={form.main_diagnosis} onChange={(e) => setForm({ ...form, main_diagnosis: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Responsável</Label><Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Telefone do responsável</Label><Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </NewItemDialog>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="Nenhum paciente cadastrado" description={isAdmin ? "Comece cadastrando o primeiro paciente." : "Aguarde o cadastro pelos administradores."} />
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Nascimento</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Diagnóstico</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Documentos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((p: any) => {
                const docStatus = isExpiring(p.patient_documents);
                const age = ageFrom(p.birth_date);
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setViewing(p)}
                  >
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-sm">
                      {p.birth_date ? new Date(p.birth_date).toLocaleDateString("pt-BR") : <span className="text-amber-700">— faltando</span>}
                    </TableCell>
                    <TableCell>{age !== null ? `${age} anos` : "—"}</TableCell>
                    <TableCell>{p.units?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.main_diagnosis ?? "—"}</TableCell>
                    <TableCell>{p.sublime_entry_date ? new Date(p.sublime_entry_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>
                      {docStatus === "expired" && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Pedido vencido</Badge>}
                      {docStatus === "warning" && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><AlertTriangle className="h-3 w-3 mr-1" />Vence em breve</Badge>}
                      {docStatus === "no-doc" && <Badge variant="outline">Sem pedido</Badge>}
                      {docStatus === "ok" && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">OK</Badge>}
                    </TableCell>
                    <TableCell>
                      {p.status === "ativo"
                        ? <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Ativo</Badge>
                        : <Badge variant="outline">Desligado</Badge>}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(p)}>
                          <Eye className="h-4 w-4 mr-1" /> Abrir
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/patients/$patientId/grade" params={{ patientId: p.id }}>
                            <CalendarClock className="h-4 w-4 mr-1" /> Grade
                          </Link>
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                            <Pencil className="h-4 w-4 mr-1" /> Editar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.full_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Data de nascimento</dt>
              <dd>{viewing.birth_date ? new Date(viewing.birth_date).toLocaleDateString("pt-BR") : "—"}</dd>
              <dt className="text-muted-foreground">Idade</dt>
              <dd>{ageFrom(viewing.birth_date) !== null ? `${ageFrom(viewing.birth_date)} anos` : "—"}</dd>
              <dt className="text-muted-foreground">Unidade</dt>
              <dd>{viewing.units?.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Diagnóstico / CID</dt>
              <dd>{viewing.main_diagnosis ?? "—"}</dd>
              <dt className="text-muted-foreground">Entrada na Sublime</dt>
              <dd>{viewing.sublime_entry_date ? new Date(viewing.sublime_entry_date).toLocaleDateString("pt-BR") : "—"}</dd>
              <dt className="text-muted-foreground">Responsável</dt>
              <dd>{viewing.guardian_name ?? "—"}</dd>
              <dt className="text-muted-foreground">Telefone</dt>
              <dd>{viewing.guardian_phone ?? "—"}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{viewing.status === "ativo" ? "Ativo" : "Desligado"}</dd>
              {viewing.notes && (<>
                <dt className="text-muted-foreground">Observações</dt>
                <dd className="whitespace-pre-wrap">{viewing.notes}</dd>
              </>)}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
