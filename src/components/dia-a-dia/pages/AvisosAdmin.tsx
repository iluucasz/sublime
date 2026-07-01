import { useEffect, useState } from "react";
import { supabase } from "../db";
import { useDiaAuth } from "../use-dia-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Users, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Patient { id: string; child_name: string; }
interface Group { id: string; name: string; member_ids: string[]; }

const CATEGORIES = [
  { value: "billing", label: "Faturamento" },
  { value: "reception", label: "Recepção" },
  { value: "clinical", label: "Clínico" },
  { value: "event", label: "Eventos Sublime" },
  { value: "customer_success", label: "Sucesso ao Cliente" },
];

export default function AvisosAdmin() {
  const { user, canSendAvisos } = useDiaAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [professionals, setProfessionals] = useState<string[]>([]);
  const [mode, setMode] = useState<"all" | "select" | "group" | "professional">("all");
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedProfessional, setSelectedProfessional] = useState<string>("");
  const [form, setForm] = useState({ category: "clinical", title: "", message: "", send_whatsapp: true });
  const [busy, setBusy] = useState(false);
  const [sentNotices, setSentNotices] = useState<any[]>([]);

  // group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupPatients, setNewGroupPatients] = useState<Set<string>>(new Set());

  const loadAll = async () => {
    const [{ data: pts }, { data: gs }, { data: gms }, { data: ns }, { data: profs }] = await Promise.all([
      supabase.from("dd_patients").select("id,child_name").order("child_name"),
      supabase.from("dd_patient_groups").select("id,name").order("name"),
      supabase.from("dd_patient_group_members").select("group_id,patient_id"),
      supabase.from("dd_notices").select("*, dd_patients(child_name)").order("created_at", { ascending: false }).limit(20),
      supabase.from("dd_professionals").select("name").eq("active", true).order("name"),
    ]);
    setProfessionals(Array.from(new Set((profs ?? []).map((p: any) => p.name).filter(Boolean))));
    setPatients((pts as Patient[]) ?? []);
    const grouped: Group[] = (gs ?? []).map((g: any) => ({
      id: g.id,
      name: g.name,
      member_ids: (gms ?? []).filter((m: any) => m.group_id === g.id).map((m: any) => m.patient_id),
    }));
    setGroups(grouped);
    setSentNotices(ns ?? []);

    // resolve author profiles (profiles.id = auth uid no schema consolidado)
    const ids = Array.from(new Set((ns ?? []).map((n: any) => n.created_by).filter(Boolean)));
    if (ids.length) {
      const { data: authors } = await supabase.from("profiles").select("id,full_name").in("id", ids as string[]);
      const map: Record<string, string> = {};
      (authors ?? []).forEach((p: any) => { map[p.id] = p.full_name || ""; });
      setProfilesMap(map);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const togglePatient = (id: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const send = async () => {
    if (!form.title || !form.message) return toast.error("Preencha título e mensagem");
    let targets: (string | null)[] = [];
    if (mode === "all") {
      if (patients.length === 0) return toast.error("Nenhum paciente cadastrado");
      targets = patients.map((p) => p.id);
    } else if (mode === "select") {
      if (selectedPatients.size === 0) return toast.error("Selecione ao menos um paciente");
      targets = Array.from(selectedPatients);
    } else if (mode === "group") {
      const g = groups.find((x) => x.id === selectedGroup);
      if (!g || g.member_ids.length === 0) return toast.error("Grupo vazio ou não selecionado");
      targets = g.member_ids;
    } else {
      if (!selectedProfessional) return toast.error("Selecione um profissional");
      const { data: sched, error: schedErr } = await supabase
        .from("dd_therapy_schedule")
        .select("patient_id")
        .eq("professional", selectedProfessional);
      if (schedErr) return toast.error(schedErr.message);
      const ids = Array.from(new Set((sched ?? []).map((s: any) => s.patient_id).filter(Boolean))) as string[];
      if (ids.length === 0) return toast.error("Nenhum paciente vinculado a este profissional");
      targets = ids;
    }

    setBusy(true);
    const FOOTER = "\n\n---\nATENÇÃO! Por favor não responder essa mensagem por esse canal.\nGrupo Sublime - www.sublimegrupo.com.br\nWhatsApp: 21 98668-0771";
    const messageWithFooter = form.message.includes("sublimegrupo.com.br") ? form.message : form.message + FOOTER;
    const rows = targets.map((pid) => ({
      patient_id: pid,
      category: form.category,
      title: form.title,
      message: messageWithFooter,
      send_whatsapp: form.send_whatsapp,
      created_by: user?.id ?? null,
    }));
    const { data, error } = await supabase.from("dd_notices").insert(rows).select("id");
    if (error) { setBusy(false); return toast.error(error.message); }

    if (form.send_whatsapp && data) {
      const { error: fnErr } = await supabase.functions.invoke("send-whatsapp-notice", {
        body: { notice_ids: data.map((d: any) => d.id) },
      });
      if (fnErr) toast.warning("Aviso salvo, mas WhatsApp falhou: " + fnErr.message);
    }
    setBusy(false);
    toast.success(`Aviso enviado para ${rows.length} destinatário(s)`);
    setForm({ category: form.category, title: "", message: "", send_whatsapp: true });
    setSelectedPatients(new Set());
    loadAll();
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return toast.error("Informe o nome do grupo");
    if (newGroupPatients.size === 0) return toast.error("Selecione pacientes");
    const { data, error } = await supabase.from("dd_patient_groups").insert({ name: newGroupName.trim(), created_by: user?.id ?? null }).select("id").single();
    if (error) return toast.error(error.message);
    const members = Array.from(newGroupPatients).map((pid) => ({ group_id: data.id, patient_id: pid }));
    const { error: mErr } = await supabase.from("dd_patient_group_members").insert(members);
    if (mErr) return toast.error(mErr.message);
    toast.success("Grupo criado");
    setNewGroupName(""); setNewGroupPatients(new Set()); setGroupDialogOpen(false);
    loadAll();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Excluir este grupo?")) return;
    const { error } = await supabase.from("dd_patient_groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Grupo excluído");
    if (selectedGroup === id) setSelectedGroup("");
    loadAll();
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-sublime-navy">Avisos</h1>
        <p className="text-sm text-muted-foreground">
          {canSendAvisos
            ? "Envie comunicados para os responsáveis no app e no WhatsApp"
            : "Visualize os avisos enviados aos responsáveis"}
        </p>
      </div>

      {canSendAvisos && (
      <Card>
        <CardHeader><CardTitle className="text-base">Novo aviso</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Categoria (setor)</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Destinatários</Label>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" size="sm" variant={mode === "all" ? "default" : "outline"} onClick={() => setMode("all")}>Todos</Button>
              <Button type="button" size="sm" variant={mode === "select" ? "default" : "outline"} onClick={() => setMode("select")}>Selecionar pacientes</Button>
              <Button type="button" size="sm" variant={mode === "group" ? "default" : "outline"} onClick={() => setMode("group")}>Grupo</Button>
              <Button type="button" size="sm" variant={mode === "professional" ? "default" : "outline"} onClick={() => setMode("professional")}>Profissional</Button>
              <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" size="sm" variant="ghost"><Users className="h-4 w-4 mr-1" />Gerenciar grupos</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Grupos de pacientes</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {groups.length === 0 && <p className="text-sm text-muted-foreground">Nenhum grupo criado.</p>}
                      {groups.map((g) => (
                        <div key={g.id} className="flex items-center justify-between border rounded p-2">
                          <div>
                            <p className="text-sm font-medium">{g.name}</p>
                            <p className="text-xs text-muted-foreground">{g.member_ids.length} paciente(s)</p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => deleteGroup(g.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-3 space-y-2">
                      <Label>Novo grupo</Label>
                      <Input placeholder="Nome do grupo" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                      <ScrollArea className="h-48 border rounded p-2">
                        <div className="space-y-1">
                          {patients.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox checked={newGroupPatients.has(p.id)} onCheckedChange={() => togglePatient(p.id, newGroupPatients, setNewGroupPatients)} />
                              {p.child_name}
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createGroup}><Plus className="h-4 w-4 mr-1" />Criar grupo</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {mode === "select" && (
              <ScrollArea className="h-48 border rounded p-2">
                <div className="space-y-1">
                  {patients.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={selectedPatients.has(p.id)} onCheckedChange={() => togglePatient(p.id, selectedPatients, setSelectedPatients)} />
                      {p.child_name}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            {mode === "select" && selectedPatients.size > 0 && (
              <p className="text-xs text-muted-foreground">{selectedPatients.size} selecionado(s)</p>
            )}

            {mode === "group" && (
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger><SelectValue placeholder="Escolha um grupo" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({g.member_ids.length})</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {mode === "professional" && (
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger><SelectValue placeholder="Escolha um profissional" /></SelectTrigger>
                <SelectContent>
                  {professionals.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Mensagem</Label><Textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={form.send_whatsapp} onCheckedChange={(v) => setForm({ ...form, send_whatsapp: v })} />
            <Label>Enviar também por WhatsApp</Label>
          </div>
          <Button onClick={send} disabled={busy}><Send className="h-4 w-4 mr-1" />{busy ? "Enviando..." : "Enviar aviso"}</Button>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos Avisos Enviados</CardTitle></CardHeader>
        <CardContent className="p-0">
          {sentNotices.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Nenhum aviso encontrado.</p>
          ) : (
            <div className="divide-y">
              {sentNotices.map((n) => {
                const catLabel = CATEGORIES.find((c) => c.value === n.category)?.label || n.category;
                const author = n.created_by ? (profilesMap[n.created_by] || "Usuário") : "—";
                return (
                  <div key={n.id} className="p-4 flex items-start justify-between hover:bg-accent/50 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{catLabel}</Badge>
                        <p className="font-semibold">{n.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Para: {n.dd_patients?.child_name || (n.patient_id === null ? "Todos os pacientes" : "Desconhecido")}
                        {" · "}Enviado por: <span className="font-medium">{author}</span>
                        {" · "}Lido: {n.read_at ? new Date(n.read_at).toLocaleString("pt-BR") : "Não lido"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
