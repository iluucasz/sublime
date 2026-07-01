import { useEffect, useState } from "react";
import { supabase } from "../db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, PowerOff, Power, Edit, Download } from "lucide-react";
import { exportToCsv } from "../exportCsv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Professional {
  id: string;
  name: string;
  role: string | null;
  work_days: string | null;
  active: boolean;
  unit: string | null;
  notes: string | null;
}

export default function Profissionais() {
  const [list, setList] = useState<Professional[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", role: "", work_days: "", unit: "", notes: "" });

  const load = () => supabase.from("dd_professionals").select("*").order("name").then(({ data }: any) => setList((data as Professional[]) ?? []));

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({ id: "", name: "", role: "", work_days: "", unit: "", notes: "" });
  };

  const handleOpenNew = () => {
    resetForm();
    setOpen(true);
  };

  const handleEdit = (p: Professional) => {
    setForm({
      id: p.id,
      name: p.name,
      role: p.role || "",
      work_days: p.work_days || "",
      unit: p.unit || "",
      notes: p.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error("Nome obrigatório");

    if (form.id) {
      const { error } = await supabase.from("dd_professionals").update({
        name: form.name,
        role: form.role || null,
        work_days: form.work_days || null,
        unit: form.unit || null,
        notes: form.notes || null,
      }).eq("id", form.id);

      if (error) toast.error(error.message);
      else { toast.success("Cadastro atualizado"); setOpen(false); resetForm(); load(); }
    } else {
      const { error } = await supabase.from("dd_professionals").insert({
        name: form.name,
        role: form.role || null,
        work_days: form.work_days || null,
        unit: form.unit || null,
        notes: form.notes || null,
        active: true,
      });

      if (error) toast.error(error.message);
      else { toast.success("Profissional criado"); setOpen(false); resetForm(); load(); }
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir profissional permanentemente?")) return;
    const { error } = await supabase.from("dd_professionals").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  const toggleActive = async (p: Professional) => {
    const { error } = await supabase.from("dd_professionals").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success(`Profissional ${p.active ? 'inativado' : 'ativado'}`); load(); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sublime-navy">Profissionais</h1>
          <p className="text-sm text-muted-foreground">Gerenciar cadastro de profissionais/terapeutas</p>
        </div>
        <div className="flex gap-2">
        <Button variant="outline" onClick={() => exportToCsv("profissionais", list.map(p => ({
          Nome: p.name,
          Função: p.role ?? "",
          Unidade: p.unit ?? "",
          "Dias/Horários": p.work_days ?? "",
          Status: p.active ? "Ativo" : "Inativo",
          Observações: p.notes ?? "",
        })))}><Download className="h-4 w-4 mr-1"/>Exportar</Button>
        <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
          <DialogTrigger asChild><Button onClick={handleOpenNew}><Plus className="h-4 w-4 mr-1"/>Novo</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{form.id ? "Editar Profissional" : "Novo Profissional"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/></div>
              <div><Label>Função / Especialidade</Label><Input value={form.role} onChange={(e)=>setForm({...form, role:e.target.value})}/></div>
              <div><Label>Unidade de Atendimento</Label>
                <Select value={form.unit} onValueChange={(v)=>setForm({...form, unit:v})}>
                  <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Laranjeiras">Laranjeiras</SelectItem>
                    <SelectItem value="São João de Meriti">São João de Meriti</SelectItem>
                    <SelectItem value="Flamengo">Flamengo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Dias e Horários de Trabalho</Label><Input placeholder="Ex: Seg a Sex, 08:00 às 18:00" value={form.work_days} onChange={(e)=>setForm({...form, work_days:e.target.value})}/></div>
              <div><Label>Observações Internas</Label><Textarea placeholder="Anotações visíveis apenas para administração" value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} className="resize-none h-20" /></div>
            </div>
            <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card><CardContent className="p-0">
        {list.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nenhum profissional cadastrado.</p> : (
          <div className="divide-y">
            {list.map((p) => (
              <div key={p.id} className={`flex items-center justify-between p-4 hover:bg-accent/50 ${!p.active ? 'opacity-60' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.name}</p>
                    {!p.active && <Badge variant="secondary">Inativo</Badge>}
                    {p.unit && <Badge variant="outline" className="text-[10px]">{p.unit}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.role || "Sem função definida"}
                  </p>
                  {p.work_days && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-sublime-navy/80">Horário:</span> {p.work_days}
                    </p>
                  )}
                  {p.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic text-orange-600/80">
                      Obs: {p.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={()=>handleEdit(p)} title="Editar"><Edit className="h-4 w-4 text-blue-500"/></Button>
                  <Button size="sm" variant={p.active ? "secondary" : "default"} onClick={()=>toggleActive(p)} title={p.active ? "Inativar" : "Ativar"}>
                    {p.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={()=>remove(p.id)} title="Excluir"><Trash2 className="h-4 w-4 text-red-500"/></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
