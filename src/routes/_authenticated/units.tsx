import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState, NewItemDialog, NewButton } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/units")({
  head: () => ({ meta: [{ title: "Unidades — ACT Sublime" }] }),
  component: UnitsPage,
});

const emptyForm = { name: "", address: "", phone: "" };

function UnitsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("units").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("units").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Unidade atualizada" : "Unidade cadastrada");
      qc.invalidateQueries({ queryKey: ["units"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (u: any) => {
    setEditing(u);
    setForm({ name: u.name ?? "", address: u.address ?? "", phone: u.phone ?? "" });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Unidades"
        description="Cadastro das unidades do Grupo Sublime"
        action={isAdmin && <NewButton onClick={openNew} label="Nova unidade" />}
      />
      <NewItemDialog
        title={editing ? "Editar unidade" : "Nova unidade"}
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}
        onSubmit={() => save.mutateAsync()}
        submitting={save.isPending}
      >
        <div className="space-y-2"><Label>Nome *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      </NewItemDialog>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="Nenhuma unidade cadastrada" description={isAdmin ? "Clique em 'Nova unidade' para começar." : "Aguarde o cadastro pelos administradores."} />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Endereço</TableHead><TableHead>Telefone</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.address ?? "—"}</TableCell>
                  <TableCell>{u.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                    )}
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
