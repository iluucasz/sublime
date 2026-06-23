import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PageHeader,
  EmptyState,
  NewItemDialog,
  NewButton,
} from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Upload, Pencil, KeyRound, Search, CheckCircle2, XCircle } from "lucide-react";
import { inviteUserAccess, resendInviteEmail } from "@/lib/users.functions";
import { ScheduleEditor } from "@/components/schedule-editor";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — ACT Sublime" }] }),
  component: UsuariosPage,
});

const COUNCILS = ["CRP", "CREFITO", "CRFa", "CRM", "CRN", "CREF", "CRESS", "CRP-MT", "Outro"];

const CARGOS = [
  { v: "diretoria", l: "Diretoria" },
  { v: "responsavel_tecnico", l: "Responsável Técnico" },
  { v: "profissional_lideranca", l: "Profissional de Liderança" },
  { v: "profissional", l: "Profissional" },
];
const cargoLabel = (v?: string | null) =>
  CARGOS.find((c) => c.v === v)?.l ?? "—";

const emptyProf = {
  full_name: "", email: "", phone: "", cpf: "",
  council_type: "", council_number: "",
  specialty_id: "", unit_id: "",
  admission_date: new Date().toISOString().slice(0, 10),
  schedule_text: "",
};
const emptyOp = {
  full_name: "", email: "", phone: "", role_title: "", cargo: "",
  unit_id: "",
  admission_date: new Date().toISOString().slice(0, 10),
};

type Kind = "operator" | "professional";

function UsuariosPage() {
  const qc = useQueryClient();
  const { isAdmin, isRespTecnicoOrAdmin } = useAuth();
  const invite = useServerFn(inviteUserAccess);
  const resend = useServerFn(resendInviteEmail);

  const [q, setQ] = useState("");
  const [fKind, setFKind] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fAccess, setFAccess] = useState<string>("all");
  const [fUnit, setFUnit] = useState<string>("all");

  const [createKind, setCreateKind] = useState<Kind | null>(null);
  const [editing, setEditing] = useState<{ kind: Kind; row: any } | null>(null);
  const [profForm, setProfForm] = useState(emptyProf);
  const [opForm, setOpForm] = useState(emptyOp);
  const [stampFor, setStampFor] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "terminate" | "reactivate" | "delete";
    kind: Kind;
    id: string;
    name: string;
  } | null>(null);

  const { data: pros, isLoading: lp } = useQuery({
    queryKey: ["usuarios-professionals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*, specialties(name, color), units(name)")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: ops, isLoading: lo } = useQuery({
    queryKey: ["usuarios-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operators")
        .select("*, units(name)")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
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

  const rows = useMemo(() => {
    const merged: any[] = [
      ...(pros ?? []).map((p: any) => ({ ...p, _kind: "professional" as Kind })),
      ...(ops ?? []).map((o: any) => ({ ...o, _kind: "operator" as Kind })),
    ];
    return merged
      .filter((r) => fKind === "all" || r._kind === fKind)
      .filter((r) => fStatus === "all" || r.status === fStatus)
      .filter((r) =>
        fAccess === "all"
          ? true
          : fAccess === "with"
            ? !!r.user_id
            : !r.user_id,
      )
      .filter((r) => fUnit === "all" || r.unit_id === fUnit)
      .filter((r) => {
        if (!q.trim()) return true;
        const h = `${r.full_name ?? ""} ${r.email ?? ""}`.toLowerCase();
        return h.includes(q.trim().toLowerCase());
      })
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [pros, ops, fKind, fStatus, fAccess, fUnit, q]);

  // Mutations
  const saveProf = useMutation({
    mutationFn: async () => {
      const payload: any = { ...profForm };
      if (!payload.specialty_id) payload.specialty_id = null;
      if (!payload.unit_id) payload.unit_id = null;
      if (!payload.council_type) payload.council_type = null;
      if (editing && editing.kind === "professional") {
        const { error } = await supabase.from("professionals").update(payload).eq("id", editing.row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("professionals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Profissional atualizado" : "Profissional cadastrado");
      qc.invalidateQueries({ queryKey: ["usuarios-professionals"] });
      closeDialogs();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveOp = useMutation({
    mutationFn: async () => {
      const payload: any = { ...opForm };
      if (!payload.unit_id) payload.unit_id = null;
      if (!payload.cargo) delete payload.cargo;
      if (editing && editing.kind === "operator") {
        const { error } = await supabase.from("operators").update(payload).eq("id", editing.row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("operators").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Operador atualizado" : "Operador cadastrado");
      qc.invalidateQueries({ queryKey: ["usuarios-operators"] });
      closeDialogs();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const terminate = useMutation({
    mutationFn: async ({ kind, id }: { kind: Kind; id: string }) => {
      const table = kind === "operator" ? "operators" : "professionals";
      const { error } = await supabase
        .from(table)
        .update({ status: "desligado", termination_date: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desligado");
      qc.invalidateQueries({ queryKey: ["usuarios-professionals"] });
      qc.invalidateQueries({ queryKey: ["usuarios-operators"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reactivate = useMutation({
    mutationFn: async ({ kind, id }: { kind: Kind; id: string }) => {
      const table = kind === "operator" ? "operators" : "professionals";
      const { error } = await supabase
        .from(table)
        .update({ status: "ativo", termination_date: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário reativado");
      qc.invalidateQueries({ queryKey: ["usuarios-professionals"] });
      qc.invalidateQueries({ queryKey: ["usuarios-operators"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async ({ kind, id }: { kind: Kind; id: string }) => {
      const table = kind === "operator" ? "operators" : "professionals";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário excluído");
      qc.invalidateQueries({ queryKey: ["usuarios-professionals"] });
      qc.invalidateQueries({ queryKey: ["usuarios-operators"] });
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
      qc.invalidateQueries({ queryKey: ["usuarios-professionals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const inviteMut = useMutation({
    mutationFn: async (row: any) => {
      if (!row.email) throw new Error("Cadastre um e-mail antes de criar o acesso.");
      return invite({
        data: {
          kind: row._kind,
          targetId: row.id,
          email: row.email,
          fullName: row.full_name,
        },
      });
    },
    onSuccess: (r: any) => {
      toast.success(
        r?.reused
          ? "Conta existente vinculada com sucesso"
          : "Convite enviado por e-mail",
      );
      qc.invalidateQueries({ queryKey: ["usuarios-professionals"] });
      qc.invalidateQueries({ queryKey: ["usuarios-operators"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resendMut = useMutation({
    mutationFn: async (row: any) => {
      if (!row.email) throw new Error("Este usuário não tem e-mail cadastrado.");
      return resend({ data: { email: row.email, fullName: row.full_name } });
    },
    onSuccess: () => toast.success("Convite reenviado por e-mail"),
    onError: (e: any) => toast.error(e.message),
  });

  function startCreate(kind: Kind) {
    setEditing(null);
    if (kind === "professional") setProfForm(emptyProf);
    else setOpForm(emptyOp);
    setCreateKind(kind);
  }
  function startEdit(kind: Kind, row: any) {
    setEditing({ kind, row });
    if (kind === "professional") {
      setProfForm({
        full_name: row.full_name ?? "", email: row.email ?? "", phone: row.phone ?? "",
        cpf: row.cpf ?? "", council_type: row.council_type ?? "", council_number: row.council_number ?? "",
        specialty_id: row.specialty_id ?? "", unit_id: row.unit_id ?? "",
        admission_date: row.admission_date ?? new Date().toISOString().slice(0, 10),
        schedule_text: row.schedule_text ?? "",
      });
    } else {
      setOpForm({
        full_name: row.full_name ?? "", email: row.email ?? "", phone: row.phone ?? "",
        role_title: row.role_title ?? "", cargo: row.cargo ?? "", unit_id: row.unit_id ?? "",
        admission_date: row.admission_date ?? new Date().toISOString().slice(0, 10),
      });
    }
    setCreateKind(kind);
  }
  function closeDialogs() {
    setCreateKind(null);
    setEditing(null);
  }

  function handleConfirm() {
    if (!confirmAction) return;
    const { type, kind, id } = confirmAction;
    if (type === "terminate") terminate.mutate({ kind, id });
    else if (type === "reactivate") reactivate.mutate({ kind, id });
    else if (type === "delete") deleteUser.mutate({ kind, id });
    setConfirmAction(null);
  }

  async function uploadStamp(kind: "stamp" | "signature", file: File) {
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
    qc.invalidateQueries({ queryKey: ["usuarios-professionals"] });
    setStampFor({ ...stampFor, [col]: pub.publicUrl });
  }

  const loading = lp || lo;
  const dialogKind: Kind | null = createKind;

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Equipe administrativa e profissionais clínicos com ou sem acesso ao sistema."
        action={
          isAdmin && (
            <div className="flex gap-2">
              <NewButton onClick={() => startCreate("operator")} label="Novo operador" />
              <NewButton onClick={() => startCreate("professional")} label="Novo profissional" />
            </div>
          )
        }
      />

      <Card className="p-3 mb-4 grid grid-cols-1 md:grid-cols-6 gap-2">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-8" />
        </div>
        <Select value={fKind} onValueChange={setFKind}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="professional">Profissionais</SelectItem>
            <SelectItem value="operator">Operadores</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="desligado">Desligados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fAccess} onValueChange={setFAccess}>
          <SelectTrigger><SelectValue placeholder="Acesso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Com e sem acesso</SelectItem>
            <SelectItem value="with">Com acesso</SelectItem>
            <SelectItem value="without">Sem acesso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fUnit} onValueChange={setFUnit}>
          <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas unidades</SelectItem>
            {units?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhum usuário encontrado" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Especialidade / Cargo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Conselho / Função</TableHead>
                <TableHead>Carimbo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const isProf = r._kind === "professional";
                const hasAccess = !!r.user_id;
                return (
                  <TableRow key={`${r._kind}-${r.id}`}>
                    <TableCell className="font-medium">
                      <div>{r.full_name}</div>
                      {r.email && <div className="text-[11px] text-muted-foreground">{r.email}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isProf ? "default" : "secondary"} className="text-[10px]">
                        {isProf ? "Profissional" : "Operador"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {isProf ? (r.specialties?.name ?? "—") : cargoLabel(r.cargo)}
                    </TableCell>
                    <TableCell>{r.units?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {isProf
                        ? (r.council_type && r.council_number ? `${r.council_type} ${r.council_number}` : r.council_number || "—")
                        : (r.role_title ?? "—")}
                    </TableCell>
                    <TableCell>
                      {isProf ? (
                        <button
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          onClick={() => setStampFor({ id: r.id, name: r.full_name, stamp_url: r.stamp_url, signature_url: r.signature_url })}
                        >
                          <Upload className="h-3 w-3" />
                          {r.stamp_url ? "Atualizar" : "Enviar"}
                        </button>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.status === "ativo" ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Ativo</Badge>
                      ) : r.status === "pendente" ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Pendente</Badge>
                      ) : (
                        <Badge variant="outline">Desligado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasAccess ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Com login
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" /> Sem login
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {isRespTecnicoOrAdmin && !hasAccess && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={inviteMut.isPending}
                            onClick={() => inviteMut.mutate(r)}
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" /> Criar acesso
                          </Button>
                        )}
                        {isRespTecnicoOrAdmin && !hasAccess && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resendMut.isPending}
                            onClick={() => resendMut.mutate(r)}
                            title="Reenviar convite caso o link anterior tenha expirado"
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" /> Reenviar convite
                          </Button>
                        )}
                        {isRespTecnicoOrAdmin && hasAccess && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resendMut.isPending}
                            onClick={() => resendMut.mutate(r)}
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" /> Resetar senha
                          </Button>
                        )}
                        {isRespTecnicoOrAdmin && isProf && r.status === "pendente" && (
                          <Button size="sm" variant="outline" onClick={() => approve.mutate(r.id)}>Aprovar</Button>
                        )}
                        {isAdmin && (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(r._kind, r)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                        )}
                        {isAdmin && r.status === "ativo" && (
                          <button
                            className="text-xs text-destructive hover:underline self-center ml-1"
                            onClick={() => setConfirmAction({ type: "terminate", kind: r._kind, id: r.id, name: r.full_name })}
                          >
                            Desligar
                          </button>
                        )}
                        {isAdmin && r.status === "desligado" && (
                          <button
                            className="text-xs text-emerald-600 hover:underline self-center ml-1"
                            onClick={() => setConfirmAction({ type: "reactivate", kind: r._kind, id: r.id, name: r.full_name })}
                          >
                            Reativar
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            className="text-xs text-destructive hover:underline self-center ml-1"
                            onClick={() => setConfirmAction({ type: "delete", kind: r._kind, id: r.id, name: r.full_name })}
                          >
                            Excluir
                          </button>
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

      {/* Dialog: criar/editar profissional */}
      <NewItemDialog
        title={editing && editing.kind === "professional"
          ? `Editar profissional — ${editing.row.full_name}`
          : "Novo profissional"}
        open={dialogKind === "professional"}
        onOpenChange={(o) => { if (!o) closeDialogs(); }}
        onSubmit={() => saveProf.mutateAsync()}
        submitting={saveProf.isPending}
      >
        <div className="space-y-2"><Label>Nome completo *</Label><Input required value={profForm.full_name} onChange={(e) => setProfForm({ ...profForm, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>CPF</Label><Input value={profForm.cpf} onChange={(e) => setProfForm({ ...profForm, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={profForm.phone} onChange={(e) => setProfForm({ ...profForm, phone: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={profForm.email} onChange={(e) => setProfForm({ ...profForm, email: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tipo de Conselho</Label>
            <Select value={profForm.council_type} onValueChange={(v) => setProfForm({ ...profForm, council_type: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{COUNCILS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Nº Conselho</Label><Input value={profForm.council_number} onChange={(e) => setProfForm({ ...profForm, council_number: e.target.value })} placeholder="Ex: 12345/RJ" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Especialidade</Label>
            <Select value={profForm.specialty_id} onValueChange={(v) => setProfForm({ ...profForm, specialty_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{specialties?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={profForm.unit_id} onValueChange={(v) => setProfForm({ ...profForm, unit_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{units?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2"><Label>Admissão *</Label><Input type="date" required value={profForm.admission_date} onChange={(e) => setProfForm({ ...profForm, admission_date: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Horários / Escala</Label>
          <ScheduleEditor
            value={profForm.schedule_text}
            onChange={(v) => setProfForm({ ...profForm, schedule_text: v })}
            mode="modal"
          />
        </div>
      </NewItemDialog>

      {/* Dialog: criar/editar operador */}
      <NewItemDialog
        title={editing && editing.kind === "operator"
          ? `Editar operador — ${editing.row.full_name}`
          : "Novo operador"}
        open={dialogKind === "operator"}
        onOpenChange={(o) => { if (!o) closeDialogs(); }}
        onSubmit={() => saveOp.mutateAsync()}
        submitting={saveOp.isPending}
      >
        <div className="space-y-2"><Label>Nome completo *</Label><Input required value={opForm.full_name} onChange={(e) => setOpForm({ ...opForm, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={opForm.email} onChange={(e) => setOpForm({ ...opForm, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={opForm.phone} onChange={(e) => setOpForm({ ...opForm, phone: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Função</Label><Input value={opForm.role_title} onChange={(e) => setOpForm({ ...opForm, role_title: e.target.value })} placeholder="Ex: Recepcionista" /></div>
          <div className="space-y-2">
            <Label>Cargo (permissão) *</Label>
            <Select value={opForm.cargo} onValueChange={(v) => setOpForm({ ...opForm, cargo: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{CARGOS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Unidade</Label>
          <Select value={opForm.unit_id} onValueChange={(v) => setOpForm({ ...opForm, unit_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{units?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Admissão *</Label><Input type="date" required value={opForm.admission_date} onChange={(e) => setOpForm({ ...opForm, admission_date: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">O acesso de login pode ser criado depois pela ação "Criar acesso" na lista.</p>
      </NewItemDialog>

      {/* Modal de confirmação: desligar / reativar / excluir */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "terminate" && "Desligar usuário"}
              {confirmAction?.type === "reactivate" && "Reativar usuário"}
              {confirmAction?.type === "delete" && "Excluir usuário"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "terminate" && (
                <>Deseja desligar <strong>{confirmAction.name}</strong>? A data de desligamento será registrada como hoje. O usuário poderá ser reativado no futuro.</>
              )}
              {confirmAction?.type === "reactivate" && (
                <>Deseja reativar <strong>{confirmAction.name}</strong>? O usuário voltará a ter status ativo.</>
              )}
              {confirmAction?.type === "delete" && (
                <>Deseja excluir permanentemente <strong>{confirmAction.name}</strong>? Esta ação é irreversível e não poderá ser desfeita.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                confirmAction?.type === "reactivate"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {confirmAction?.type === "terminate" && "Desligar"}
              {confirmAction?.type === "reactivate" && "Reativar"}
              {confirmAction?.type === "delete" && "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: carimbo */}
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
                  <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadStamp("stamp", e.target.files[0])} />
                </div>
                <div className="space-y-2">
                  <Label>Assinatura</Label>
                  <div className="border rounded-md p-3 h-32 flex items-center justify-center bg-muted/40">
                    {stampFor.signature_url ? <img src={stampFor.signature_url} alt="" className="max-h-full" /> : <span className="text-xs text-muted-foreground">Sem assinatura</span>}
                  </div>
                  <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadStamp("signature", e.target.files[0])} />
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
