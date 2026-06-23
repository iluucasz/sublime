import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, NewItemDialog, NewButton, EmptyState } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Check, FileText, HeartPulse, Megaphone, MessageCircle, Send, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({ meta: [{ title: "Recados — ACT Sublime" }] }),
  component: AnnouncementsPage,
});

const KINDS = [
  { value: "aviso", label: "Aviso geral" },
  { value: "correcao_relatorio", label: "Pedido de correção de relatório" },
  { value: "pedido_avaliacao", label: "Pedido de avaliação" },
];

const TARGETS = [
  { value: "all", label: "Todos" },
  { value: "unit", label: "Unidade específica" },
  { value: "professional", label: "Profissional específico" },
  { value: "role", label: "Cargo" },
];

const ROLES = [
  { value: "profissional", label: "Profissionais" },
  { value: "profissional_lideranca", label: "Profissionais de liderança" },
  { value: "responsavel_tecnico", label: "Responsáveis Técnicos" },
  { value: "operador", label: "Operadores" },
];

function AnnouncementsPage() {
  const { user, isRespTecnicoOrAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: "aviso",
    title: "",
    body: "",
    target_type: "all",
    target_unit_id: "",
    target_professional_id: "",
    target_role: "profissional",
    report_id: "",
    patient_id: "",
  });

  const { data: list } = useQuery({
    queryKey: ["announcements-all"],
    queryFn: async () =>
      ((await supabase.from("announcements" as any).select("*").order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const { data: units } = useQuery({
    queryKey: ["units-min"],
    queryFn: async () => (await supabase.from("units").select("id, name").order("name")).data ?? [],
  });
  const { data: professionals } = useQuery({
    queryKey: ["professionals-min"],
    queryFn: async () => (await supabase.from("professionals").select("id, full_name").order("full_name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error("Título é obrigatório.");
      const payload: any = {
        author_id: user?.id,
        kind: form.kind,
        title: form.title,
        body: form.body || null,
        target_type: form.target_type,
        target_unit_id: form.target_type === "unit" ? form.target_unit_id || null : null,
        target_professional_id: form.target_type === "professional" ? form.target_professional_id || null : null,
        target_role: form.target_type === "role" ? form.target_role || null : null,
        report_id: form.report_id || null,
        patient_id: form.patient_id || null,
      };
      const { error } = await supabase.from("announcements" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recado publicado.");
      qc.invalidateQueries({ queryKey: ["announcements-all"] });
      qc.invalidateQueries({ queryKey: ["announcements-feed"] });
      setOpen(false);
      setForm({ ...form, title: "", body: "", report_id: "", patient_id: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("announcements" as any)
        .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements-all"] }),
  });

  return (
    <div>
      <PageHeader
        title="Recados"
        description="Avisos da direção clínica, pedidos de correção e pedidos de avaliação."
        action={<NewButton onClick={() => setOpen(true)} label="Novo recado" />}
      />

      {!list?.length ? (
        <EmptyState title="Nenhum recado ainda" description="Envie um recado para iniciar a conversa." />
      ) : (
        <div className="space-y-2">
          {list.map((a: any) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              currentUserId={user?.id}
              isAdmin={isRespTecnicoOrAdmin}
              onResolve={() => resolve.mutate(a.id)}
            />
          ))}
        </div>
      )}

      <NewItemDialog title="Novo recado" open={open} onOpenChange={setOpen} submitting={create.isPending} onSubmit={() => create.mutate()}>
        <div>
          <Label>Tipo</Label>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Título *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Mensagem</Label>
          <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>
        <div>
          <Label>Destinatário</Label>
          <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {form.target_type === "unit" && (
          <div>
            <Label>Unidade</Label>
            <Select value={form.target_unit_id} onValueChange={(v) => setForm({ ...form, target_unit_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {units?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {form.target_type === "professional" && (
          <div>
            <Label>Profissional</Label>
            <Select value={form.target_professional_id} onValueChange={(v) => setForm({ ...form, target_professional_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {professionals?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {form.target_type === "role" && (
          <div>
            <Label>Cargo</Label>
            <Select value={form.target_role} onValueChange={(v) => setForm({ ...form, target_role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </NewItemDialog>
    </div>
  );
}

function AnnouncementCard({
  announcement: a,
  currentUserId,
  isAdmin,
  onResolve,
}: {
  announcement: any;
  currentUserId?: string;
  isAdmin: boolean;
  onResolve: () => void;
}) {
  const qc = useQueryClient();
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");

  const { data: replies } = useQuery({
    queryKey: ["ann-replies", a.id],
    enabled: showReplies,
    queryFn: async () => {
      const { data } = await supabase
        .from("announcement_replies" as any)
        .select("*")
        .eq("announcement_id", a.id)
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const { data: authorsMap } = useQuery({
    queryKey: ["ann-replies-authors", a.id, replies?.map((r: any) => r.author_id).join(",")],
    enabled: !!replies?.length,
    queryFn: async () => {
      const ids = Array.from(new Set(replies!.map((r: any) => r.author_id)));
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.full_name; });
      return map;
    },
  });

  const reply = useMutation({
    mutationFn: async () => {
      if (!replyText.trim()) throw new Error("Escreva uma resposta.");
      const { error } = await supabase.from("announcement_replies" as any).insert({
        announcement_id: a.id,
        author_id: currentUserId,
        body: replyText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta enviada.");
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["ann-replies", a.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeReply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcement_replies" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ann-replies", a.id] }),
  });

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <Badge variant={a.kind === "correcao_relatorio" ? "destructive" : "secondary"}>
            {KINDS.find((k) => k.value === a.kind)?.label ?? a.kind}
          </Badge>
          {a.resolved_at && <Badge variant="outline">Resolvido</Badge>}
          <span className="font-semibold">{a.title}</span>
        </div>
        <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
      </div>
      {a.body && <p className="text-sm whitespace-pre-line">{a.body}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        {a.report_id && (
          <Button asChild size="sm" variant="outline">
            <Link to="/reports/$reportId" params={{ reportId: a.report_id }} hash="preencher">
              <FileText className="h-3 w-3 mr-1" /> Relatório
            </Link>
          </Button>
        )}
        {a.patient_id && (
          <Button asChild size="sm" variant="outline">
            <Link to="/patients"><HeartPulse className="h-3 w-3 mr-1" /> Paciente</Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowReplies((v) => !v)}>
          <MessageCircle className="h-3 w-3 mr-1" /> Responder
        </Button>
        {!a.resolved_at && (isAdmin || a.author_id === currentUserId) && (
          <Button size="sm" variant="ghost" onClick={onResolve}>
            <Check className="h-3 w-3 mr-1" /> Marcar resolvido
          </Button>
        )}
      </div>

      {showReplies && (
        <div className="border-t pt-3 mt-2 space-y-2">
          {replies?.length ? (
            <div className="space-y-2">
              {replies.map((r: any) => (
                <div key={r.id} className="rounded-md bg-muted/40 p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-xs">{authorsMap?.[r.author_id] ?? "Usuário"}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                      {r.author_id === currentUserId && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeReply.mutate(r.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-line mt-1">{r.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma resposta ainda.</p>
          )}
          <div className="flex gap-2">
            <Textarea
              rows={2}
              placeholder="Escreva uma resposta..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <Button size="sm" onClick={() => reply.mutate()} disabled={reply.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
