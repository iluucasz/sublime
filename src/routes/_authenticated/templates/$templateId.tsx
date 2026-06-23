import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, NewItemDialog, NewButton } from "@/components/page-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FieldsEditor, type FormField } from "@/components/form-fields";
import { EditHistoryButton } from "@/components/edit-history";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Trash2, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates/$templateId")({
  head: () => ({ meta: [{ title: "Modelo — ACT Sublime" }] }),
  component: TemplateDetail,
});

function TemplateDetail() {
  const { templateId } = Route.useParams();
  const qc = useQueryClient();
  const { isRespTecnicoOrAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", specialty_id: "", description: "", requires_assessment: false });
  const [fieldsModule, setFieldsModule] = useState<any | null>(null);
  const [fieldsDraft, setFieldsDraft] = useState<FormField[]>([]);

  const { data: tpl } = useQuery({
    queryKey: ["report_template", templateId],
    queryFn: async () => (await supabase.from("report_templates").select("*").eq("id", templateId).single()).data,
  });

  const { data: modules } = useQuery({
    queryKey: ["report_template_modules", templateId],
    queryFn: async () =>
      (await supabase
        .from("report_template_modules")
        .select("*, specialties(name)")
        .eq("template_id", templateId)
        .order("order_index")).data ?? [],
  });

  const { data: specialties } = useQuery({
    queryKey: ["specialties-min"],
    queryFn: async () => (await supabase.from("specialties").select("id, name").order("name")).data ?? [],
  });

  const addModule = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error("Título obrigatório.");
      const order_index = (modules?.length ?? 0);
      const payload: any = {
        template_id: templateId,
        title: form.title,
        description: form.description || null,
        specialty_id: form.specialty_id || null,
        requires_assessment: form.requires_assessment,
        order_index,
        fields: [],
      };
      const { error } = await supabase.from("report_template_modules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Módulo adicionado.");
      qc.invalidateQueries({ queryKey: ["report_template_modules", templateId] });
      setOpen(false);
      setForm({ title: "", specialty_id: "", description: "", requires_assessment: false });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_template_modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report_template_modules", templateId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const saveFields = useMutation({
    mutationFn: async () => {
      if (!fieldsModule) return;
      const { error } = await supabase
        .from("report_template_modules")
        .update({ fields: fieldsDraft as any })
        .eq("id", fieldsModule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perguntas salvas.");
      qc.invalidateQueries({ queryKey: ["report_template_modules", templateId] });
      setFieldsModule(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openFields = (m: any) => {
    setFieldsModule(m);
    setFieldsDraft(Array.isArray(m.fields) ? m.fields : []);
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/templates"><ArrowLeft className="h-4 w-4 mr-1" /> Modelos</Link>
      </Button>
      <PageHeader
        title={tpl?.name ?? "Modelo"}
        description={tpl?.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <EditHistoryButton entityType="report_template" entityId={templateId} includeChildren />
            {isRespTecnicoOrAdmin ? <NewButton onClick={() => setOpen(true)} label="Adicionar módulo" /> : null}
          </div>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Escopo</TableHead>
              <TableHead>Perguntas</TableHead>
              <TableHead>Avaliação?</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules?.map((m: any, i: number) => {
              const count = Array.isArray(m.fields) ? m.fields.length : 0;
              return (
                <TableRow key={m.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{m.title}</TableCell>
                  <TableCell>{m.specialties?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md">{m.description ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={count ? "default" : "outline"}>{count} {count === 1 ? "pergunta" : "perguntas"}</Badge>
                  </TableCell>
                  <TableCell>{m.requires_assessment ? "Sim" : "—"}</TableCell>
                  <TableCell className="text-right">
                    {isRespTecnicoOrAdmin && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openFields(m)}>
                          <ListChecks className="h-4 w-4 mr-1" /> Perguntas
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!modules?.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum módulo neste modelo ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <NewItemDialog title="Novo módulo" open={open} onOpenChange={setOpen} submitting={addModule.isPending} onSubmit={() => addModule.mutate()}>
        <div>
          <Label>Título *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Fonoaudiologia — desenvolvimento de linguagem" />
        </div>
        <div>
          <Label>Especialidade</Label>
          <Select value={form.specialty_id} onValueChange={(v) => setForm({ ...form, specialty_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {specialties?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Escopo / o que o profissional deve preencher</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.requires_assessment} onCheckedChange={(v) => setForm({ ...form, requires_assessment: !!v })} />
          Requer aplicação de avaliação
        </label>
      </NewItemDialog>

      <Dialog open={!!fieldsModule} onOpenChange={(o) => !o && setFieldsModule(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Perguntas — {fieldsModule?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Defina as perguntas que o profissional verá ao preencher este módulo no relatório.
            Escolha o tipo de cada pergunta (texto, sim/não, múltipla escolha).
          </p>
          <FieldsEditor value={fieldsDraft} onChange={setFieldsDraft} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldsModule(null)}>Cancelar</Button>
            <Button onClick={() => saveFields.mutate()} disabled={saveFields.isPending}>
              Salvar perguntas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
