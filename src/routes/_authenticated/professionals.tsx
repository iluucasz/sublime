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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, EmptyState, NewItemDialog, NewButton } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Upload, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/professionals")({
  head: () => ({ meta: [{ title: "Profissionais — ACT Sublime" }] }),
  component: ProsPage,
});

const COUNCILS = ["CRP", "CREFITO", "CRFa", "CRM", "CRN", "CREF", "CRESS", "CRP-MT", "Outro"];

const emptyForm = {
  full_name: "", email: "", phone: "", cpf: "",
  council_type: "", council_number: "",
  specialty_id: "", unit_id: "",
  admission_date: new Date().toISOString().slice(0, 10),
  schedule_text: "",
};

function ProsPage() {
  const qc = useQueryClient();
  const { isAdmin, isRespTecnicoOrAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [stampFor, setStampFor] = useState<{ id: string; name: string; stamp_url?: string | null; signature_url?: string | null } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["professionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*, specialties(name, color), units(name)")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: specialties } = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => (await supabase.from("specialties").select("*").order("name")).data ?? [],
  });
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => (await supabase.from("units").select("*").order("name")).data ?? [],
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!payload.specialty_id) payload.specialty_id = null;
      if (!payload.unit_id) payload.unit_id = null;
      if (!payload.council_type) payload.council_type = null;
      if (editing) {
        const { error } = await supabase.from("professionals").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("professionals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Profissional atualizado" : "Profissional cadastrado");
      qc.invalidateQueries({ queryKey: ["professionals"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const terminate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("professionals")
        .update({ status: "desligado", termination_date: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional desligado");
      qc.invalidateQueries({ queryKey: ["professionals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("professionals")
        .update({ status: "ativo" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional aprovado");
      qc.invalidateQueries({ queryKey: ["professionals"] });
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
      email: p.email ?? "",
      phone: p.phone ?? "",
      cpf: p.cpf ?? "",
      council_type: p.council_type ?? "",
      council_number: p.council_number ?? "",
      specialty_id: p.specialty_id ?? "",
      unit_id: p.unit_id ?? "",
      admission_date: p.admission_date ?? new Date().toISOString().slice(0, 10),
      schedule_text: p.schedule_text ?? "",
    });
    setOpen(true);
  };

  async function uploadFile(kind: "stamp" | "signature", file: File) {
    if (!stampFor) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${stampFor.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("professional-stamps")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) return toast.error(upErr.message);
    const { data: pub } = supabase.storage.from("professional-stamps").getPublicUrl(path);
    const col = kind === "stamp" ? "stamp_url" : "signature_url";
    const update: any = { [col]: pub.publicUrl };
    const { error } = await supabase.from("professionals").update(update).eq("id", stampFor.id);
    if (error) return toast.error(error.message);
    toast.success(`${kind === "stamp" ? "Carimbo" : "Assinatura"} enviado`);
    qc.invalidateQueries({ queryKey: ["professionals"] });
    setStampFor({ ...stampFor, [col]: pub.publicUrl });
  }

  return (
    <div>
      <PageHeader
        title="Profissionais"
        description={`${data?.length ?? 0} cadastrados`}
        action={isAdmin && <NewButton onClick={startCreate} label="Novo profissional" />}
      />

      <NewItemDialog
        title={editing ? `Editar profissional — ${editing.full_name}` : "Novo profissional"}
        open={open}
        onOpenChange={(o) => { if (!o) { setOpen(false); setEditing(null); } else setOpen(true); }}
        onSubmit={() => upsertMutation.mutateAsync()}
        submitting={upsertMutation.isPending}
      >
        <div className="space-y-2"><Label>Nome completo *</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tipo de Conselho</Label>
            <Select value={form.council_type} onValueChange={(v) => setForm({ ...form, council_type: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{COUNCILS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Nº Conselho</Label><Input value={form.council_number} onChange={(e) => setForm({ ...form, council_number: e.target.value })} placeholder="Ex: 12345/RJ" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Especialidade</Label>
            <Select value={form.specialty_id} onValueChange={(v) => setForm({ ...form, specialty_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{specialties?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2"><Label>Admissão *</Label><Input type="date" required value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} /></div>
        <div className="space-y-2"><Label>Horários / Escala</Label><Input value={form.schedule_text} onChange={(e) => setForm({ ...form, schedule_text: e.target.value })} placeholder="Seg: 08-18, Ter: 13-18..." /></div>
      </NewItemDialog>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="Nenhum profissional cadastrado" />
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Conselho</TableHead>
              <TableHead>Carimbo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.specialties?.name ?? "—"}</TableCell>
                  <TableCell>{p.units?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {p.council_type && p.council_number ? `${p.council_type} ${p.council_number}` : p.council_number || "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      onClick={() => setStampFor({ id: p.id, name: p.full_name, stamp_url: p.stamp_url, signature_url: p.signature_url })}
                    >
                      <Upload className="h-3 w-3" />
                      {p.stamp_url ? "Atualizar" : "Enviar"}
                    </button>
                  </TableCell>
                  <TableCell>
                    {p.status === "ativo" ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Ativo</Badge>
                    ) : p.status === "pendente" ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Pendente</Badge>
                    ) : (
                      <Badge variant="outline">Desligado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isRespTecnicoOrAdmin && p.status === "pendente" && (
                        <Button size="sm" variant="default" onClick={() => approve.mutate(p.id)}>
                          Aprovar
                        </Button>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                          <Pencil className="h-4 w-4 mr-1" /> Editar
                        </Button>
                      )}
                      {isAdmin && p.status === "ativo" && (
                        <button className="text-xs text-destructive hover:underline ml-2" onClick={() => terminate.mutate(p.id)}>Desligar</button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!stampFor} onOpenChange={(o) => !o && setStampFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Carimbo e assinatura — {stampFor?.name}</DialogTitle></DialogHeader>
          {stampFor && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Carimbo</Label>
                  <div className="border rounded-md p-3 h-32 flex items-center justify-center bg-muted/40">
                    {stampFor.stamp_url ? <img src={stampFor.stamp_url} alt="" className="max-h-full" /> : <span className="text-xs text-muted-foreground">Sem carimbo</span>}
                  </div>
                  <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("stamp", e.target.files[0])} />
                </div>
                <div className="space-y-2">
                  <Label>Assinatura</Label>
                  <div className="border rounded-md p-3 h-32 flex items-center justify-center bg-muted/40">
                    {stampFor.signature_url ? <img src={stampFor.signature_url} alt="" className="max-h-full" /> : <span className="text-xs text-muted-foreground">Sem assinatura</span>}
                  </div>
                  <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("signature", e.target.files[0])} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PNG com fundo transparente funciona melhor nos relatórios impressos.</p>
              <Button variant="outline" onClick={() => setStampFor(null)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
