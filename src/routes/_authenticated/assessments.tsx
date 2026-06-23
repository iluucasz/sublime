import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, NewItemDialog, NewButton } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { ClipboardCheck, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assessments")({
  head: () => ({ meta: [{ title: "Avaliações — ACT Sublime" }] }),
  beforeLoad: () => {
    // Server RLS já bloqueia; sidebar oculta. Aqui um soft guard adicional fica no componente.
  },
  component: AssessmentsLayout,
});

function AssessmentsLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (pathname !== "/assessments") return <Outlet />;
  return <AssessmentsPage />;
}

function AssessmentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, isRespTecnicoOrAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", specialty_id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () =>
      (await supabase.from("assessments").select("*, specialties(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: specialties } = useQuery({
    queryKey: ["specialties-min"],
    queryFn: async () => (await supabase.from("specialties").select("id, name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Nome obrigatório.");
      const payload: any = { name: form.name, description: form.description || null, created_by: user?.id };
      if (form.specialty_id) payload.specialty_id = form.specialty_id;
      const { data, error } = await supabase.from("assessments").insert(payload).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success("Avaliação criada.");
      qc.invalidateQueries({ queryKey: ["assessments"] });
      setOpen(false);
      setForm({ name: "", description: "", specialty_id: "" });
      if (d?.id) navigate({ to: "/assessments/$assessmentId", params: { assessmentId: d.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Avaliações"
        description="Catálogo de avaliações com itens e aplicações para gerar gráficos de evolução."
        action={isRespTecnicoOrAdmin ? <NewButton onClick={() => setOpen(true)} label="Nova avaliação" /> : undefined}
      />


      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : !data?.length ? (
          <EmptyState title="Nenhuma avaliação ainda" description="Crie um catálogo de avaliações para acompanhar a evolução das crianças." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.specialties?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md">{a.description ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/assessments/$assessmentId" params={{ assessmentId: a.id }}>
                          <ClipboardCheck className="h-4 w-4 mr-1" /> Abrir
                        </Link>
                      </Button>
                      {isRespTecnicoOrAdmin && (
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => navigate({ to: "/assessments/$assessmentId", params: { assessmentId: a.id } })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <NewItemDialog title="Nova avaliação" open={open} onOpenChange={setOpen} submitting={create.isPending} onSubmit={() => create.mutate()}>
        <div>
          <Label>Nome *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: PEP-3, ABLLS-R, Vineland" />
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
          <Label>Descrição</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </NewItemDialog>
    </div>
  );
}
