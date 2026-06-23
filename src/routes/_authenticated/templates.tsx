import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, NewItemDialog, NewButton } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Modelos de Relatório — ACT Sublime" }] }),
  component: TemplatesLayout,
});

function TemplatesLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (pathname !== "/templates") return <Outlet />;
  return <TemplatesPage />;
}

function TemplatesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, isRespTecnicoOrAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["report_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Nome obrigatório.");
      const { data, error } = await supabase
        .from("report_templates")
        .insert({ ...form, created_by: user?.id, status: "ativo" })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Modelo criado. Agora adicione os módulos.");
      qc.invalidateQueries({ queryKey: ["report_templates"] });
      qc.invalidateQueries({ queryKey: ["report_templates-min"] });
      setOpen(false);
      setForm({ name: "", description: "" });
      if (data?.id) navigate({ to: "/templates/$templateId", params: { templateId: data.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Modelos de Relatório"
        description="Defina o escopo que cada profissional deverá preencher por especialidade."
        action={isRespTecnicoOrAdmin ? <NewButton onClick={() => setOpen(true)} label="Novo modelo" /> : null}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : !data?.length ? (
          <EmptyState title="Nenhum modelo ainda" description="Crie um modelo para padronizar os relatórios da clínica." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.description ?? "—"}</TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/templates/$templateId" params={{ templateId: t.id }}>
                        <FileText className="h-4 w-4 mr-1" /> Abrir
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <NewItemDialog title="Novo modelo" open={open} onOpenChange={setOpen} submitting={create.isPending} onSubmit={() => create.mutate()}>
        <div>
          <Label>Nome *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Relatório semestral padrão" />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <p className="text-xs text-muted-foreground">
          Após salvar, você será levado para a tela do modelo onde poderá <strong>cadastrar módulos</strong> (ex.: Anamnese, Evolução, Plano terapêutico) e, em cada módulo, definir as <strong>perguntas</strong> que o profissional vai responder (texto livre, sim/não, múltipla escolha, número e escala — os campos numéricos geram gráficos de evolução).
        </p>
      </NewItemDialog>
    </div>
  );
}
