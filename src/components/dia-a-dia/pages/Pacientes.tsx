import { useEffect, useState } from "react";
import { supabase } from "../db";
import { useDiaAuth } from "../use-dia-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Calendar as CalIcon, FileText, Upload as UploadIcon, PowerOff, Power, Download, ArrowLeft } from "lucide-react";
import { exportToCsv } from "../exportCsv";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Patient { id: string; child_name: string; admission_date: string | null; parent_user_id: string | null; notes: string | null; active: boolean; medical_request_date: string | null; unit: string | null; }
interface Slot { id: string; weekday: string; start_time: string; end_time: string; professional: string; room: string | null; therapy_type: string | null; }
interface Doc { id: string; title: string; doc_type: string; storage_path: string; created_at: string; size_bytes: number | null; }
// No schema consolidado, profiles.id = auth uid (não há coluna user_id).
interface ParentRow { id: string; full_name: string | null; }
interface Professional { id: string; name: string; role: string | null; }

const weekdays = [
  ["monday","Segunda"],["tuesday","Terça"],["wednesday","Quarta"],
  ["thursday","Quinta"],["friday","Sexta"],["saturday","Sábado"],["sunday","Domingo"],
];

export default function Pacientes() {
  const [selected, setSelected] = useState<string | null>(null);
  return selected
    ? <PacienteDetail id={selected} onBack={() => setSelected(null)} />
    : <PacientesList onOpen={setSelected} />;
}

function PacientesList({ onOpen }: { onOpen: (id: string) => void }) {
  const { canEditPatients } = useDiaAuth();
  const [list, setList] = useState<Patient[]>([]);
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ child_name: "", admission_date: "", parent_user_id: "", unit: "" });

  const load = () => supabase.from("dd_patients").select("*").order("child_name").then(({ data }: any) => setList((data as Patient[]) ?? []));
  useEffect(() => {
    load();
    supabase.from("profiles").select("id,full_name").then(({ data }: any) => setParents((data as ParentRow[]) ?? []));
  }, []);

  const create = async () => {
    if (!form.child_name) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("dd_patients").insert({
      child_name: form.child_name,
      admission_date: form.admission_date || null,
      parent_user_id: form.parent_user_id || null,
      unit: form.unit || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Paciente criado"); setOpen(false); setForm({ child_name:"", admission_date:"", parent_user_id:"", unit:"" }); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir paciente permanentemente?")) return;
    const { error } = await supabase.from("dd_patients").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  const toggleActive = async (p: Patient) => {
    const { error } = await supabase.from("dd_patients").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success(`Paciente ${p.active ? 'inativado' : 'ativado'}`); load(); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sublime-navy">Pacientes</h1>
          <p className="text-sm text-muted-foreground">{canEditPatients ? "Gerenciar cadastros de crianças" : "Visualizar cadastros de crianças"}</p>
        </div>
        <div className="flex gap-2">
        <Button variant="outline" onClick={() => {
          const parentName = (uid: string | null) => uid ? (parents.find(p => p.id === uid)?.full_name ?? "") : "";
          exportToCsv("pacientes", list.map(p => ({
            Nome: p.child_name,
            Unidade: p.unit ?? "",
            "Data admissão": p.admission_date ?? "",
            "Data pedido médico": p.medical_request_date ?? "",
            Responsável: parentName(p.parent_user_id),
            Status: p.active ? "Ativo" : "Inativo",
            Observações: p.notes ?? "",
          })));
        }}><Download className="h-4 w-4 mr-1"/>Exportar</Button>
        {canEditPatients && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1"/>Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Paciente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome da criança</Label><Input value={form.child_name} onChange={(e)=>setForm({...form, child_name:e.target.value})}/></div>
              <div><Label>Data de admissão</Label><Input type="date" value={form.admission_date} onChange={(e)=>setForm({...form, admission_date:e.target.value})}/></div>
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
              <div><Label>Responsável (opcional)</Label>
                <Select value={form.parent_user_id} onValueChange={(v)=>setForm({...form, parent_user_id:v})}>
                  <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                  <SelectContent>{parents.map((p)=>(<SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0,8)}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        )}
        </div>
      </div>

      <Card><CardContent className="p-0">
        {list.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nenhum paciente cadastrado.</p> : (
          <div className="divide-y">
            {list.map((p) => (
              <div key={p.id} className={`flex items-center justify-between p-4 hover:bg-accent/50 ${!p.active ? 'opacity-60' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.child_name}</p>
                    {!p.active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Admissão: {p.admission_date ? new Date(p.admission_date).toLocaleDateString("pt-BR") : "—"}
                    {!p.parent_user_id && " · sem responsável vinculado"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canEditPatients && (
                    <Button size="sm" variant={p.active ? "secondary" : "default"} onClick={()=>toggleActive(p)} title={p.active ? "Inativar" : "Ativar"}>
                      {p.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={()=>onOpen(p.id)}>{canEditPatients ? "Gerenciar" : "Visualizar"}</Button>
                  {canEditPatients && (
                    <Button size="sm" variant="ghost" onClick={()=>remove(p.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

function PacienteDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { canEditPatients } = useDiaAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [slot, setSlot] = useState({ weekday:"monday", start_time:"08:00", end_time:"09:00", professional:"", room:"", therapy_type:"" });
  const [doc, setDoc] = useState({ title:"", doc_type:"therapy_plan" as string });
  const [file, setFile] = useState<File | null>(null);
  const [medicalDate, setMedicalDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ child_name: "", admission_date: "", parent_user_id: "", unit: "" });

  const load = () => {
    supabase.from("dd_patients").select("*").eq("id", id).single().then(({ data, error }: any) => {
      if (error || !data) { toast.error("Paciente não encontrado"); onBack(); return; }
      setPatient(data as Patient);
      setEditForm({ child_name: data.child_name || "", admission_date: data.admission_date || "", parent_user_id: data.parent_user_id || "unassigned", unit: data.unit || "" });
    });
    supabase.from("dd_therapy_schedule").select("*").eq("patient_id", id).order("weekday").order("start_time").then(({ data }: any) => setSlots((data as Slot[]) ?? []));
    supabase.from("dd_documents").select("*").eq("patient_id", id).order("created_at", { ascending:false }).then(({ data }: any) => setDocs((data as Doc[]) ?? []));
    supabase.from("dd_professionals").select("*").eq("active", true).order("name").then(({ data }: any) => setProfessionals((data as Professional[]) ?? []));
    supabase.from("profiles").select("id,full_name").then(({ data }: any) => setParents((data as ParentRow[]) ?? []));
  };
  useEffect(() => { if (id) load(); }, [id]);

  const updatePatient = async () => {
    if (!editForm.child_name) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("dd_patients").update({
      child_name: editForm.child_name,
      admission_date: editForm.admission_date || null,
      parent_user_id: editForm.parent_user_id === "unassigned" ? null : editForm.parent_user_id,
      unit: editForm.unit || null,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Cadastro atualizado"); setEditOpen(false); load(); }
  };

  const addSlot = async () => {
    if (!slot.professional) return toast.error("Profissional obrigatório");
    const { error } = await supabase.from("dd_therapy_schedule").insert({ ...slot, patient_id: id, room: slot.room || null, therapy_type: slot.therapy_type || null });
    if (error) toast.error(error.message); else { toast.success("Horário adicionado"); load(); }
  };
  const removeSlot = async (sid: string) => {
    await supabase.from("dd_therapy_schedule").delete().eq("id", sid); load();
  };

  const uploadDoc = async () => {
    if (!file || !doc.title) return toast.error("Arquivo e título obrigatórios");
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g,"_")}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("dd_documents").insert({
      patient_id: id, title: doc.title, doc_type: doc.doc_type, storage_path: path, size_bytes: file.size,
    });

    if (doc.doc_type === "medical_request" && medicalDate) {
      await supabase.from("dd_patients").update({ medical_request_date: medicalDate }).eq("id", id);
    }

    setUploading(false);
    if (error) toast.error(error.message); else { toast.success("Documento enviado"); setFile(null); setDoc({ title:"", doc_type:"therapy_plan" }); setMedicalDate(""); load(); }
  };
  const removeDoc = async (d: Doc) => {
    await supabase.storage.from("documents").remove([d.storage_path]);
    await supabase.from("dd_documents").delete().eq("id", d.id);
    load();
  };

  const calculateWorkload = () => {
    let totalMinutes = 0;
    slots.forEach(s => {
      if (!s.start_time || !s.end_time) return;
      const [h1, m1] = s.start_time.split(':').map(Number);
      const [h2, m2] = s.end_time.split(':').map(Number);
      if (!isNaN(h1) && !isNaN(h2)) {
        totalMinutes += (h2 * 60 + (m2||0)) - (h1 * 60 + (m1||0));
      }
    });
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
  };

  if (!patient) return <p>Carregando...</p>;

  const isMedicalExpiring = patient.medical_request_date && Math.ceil(Math.abs(new Date().getTime() - new Date(patient.medical_request_date).getTime()) / (1000 * 60 * 60 * 24)) >= 150;

  return (
    <div className="space-y-4 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-1"><ArrowLeft className="h-4 w-4 mr-1"/>Voltar</Button>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sublime-navy">{patient.child_name}</h1>
          <p className="text-sm text-muted-foreground">Admissão: {patient.admission_date ? new Date(patient.admission_date).toLocaleDateString("pt-BR") : "—"}</p>
          {patient.parent_user_id ? (
            <p className="text-sm font-medium text-green-600 mt-1">✓ Responsável vinculado</p>
          ) : (
            <p className="text-sm font-medium text-amber-600 mt-1">⚠️ Sem responsável vinculado</p>
          )}
          {isMedicalExpiring && (
            <p className="text-sm font-bold text-red-600 mt-1">
              ⚠️ Atenção: O Pedido Médico (Laudo) está vencendo ou já venceu (validade de 6 meses).
            </p>
          )}
        </div>

        {canEditPatients && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild><Button variant="outline" size="sm">Editar Cadastro</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Paciente</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome da criança</Label><Input value={editForm.child_name} onChange={(e)=>setEditForm({...editForm, child_name:e.target.value})}/></div>
              <div><Label>Data de admissão</Label><Input type="date" value={editForm.admission_date} onChange={(e)=>setEditForm({...editForm, admission_date:e.target.value})}/></div>
              <div><Label>Unidade de Atendimento</Label>
                <Select value={editForm.unit} onValueChange={(v)=>setEditForm({...editForm, unit:v})}>
                  <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Laranjeiras">Laranjeiras</SelectItem>
                    <SelectItem value="São João de Meriti">São João de Meriti</SelectItem>
                    <SelectItem value="Flamengo">Flamengo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Responsável</Label>
                <Select value={editForm.parent_user_id} onValueChange={(v)=>setEditForm({...editForm, parent_user_id:v})}>
                  <SelectTrigger><SelectValue placeholder="Sem responsável"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sem responsável</SelectItem>
                    {parents.map((p)=>(<SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0,8)}</SelectItem>))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Vincule o responsável para que ele possa acessar os dados deste paciente.</p>
              </div>
            </div>
            <DialogFooter><Button onClick={updatePatient}>Salvar Alterações</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Tabs defaultValue="grade">
        <TabsList>
          <TabsTrigger value="grade"><CalIcon className="h-4 w-4 mr-1"/>Grade</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="h-4 w-4 mr-1"/>Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="grade" className="space-y-4">
          {canEditPatients && (
          <Card>
            <CardHeader><CardTitle className="text-base">Adicionar horário</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div><Label>Dia</Label>
                <Select value={slot.weekday} onValueChange={(v)=>setSlot({...slot, weekday:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{weekdays.map(([k,l])=><SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Início</Label><Input type="time" value={slot.start_time} onChange={(e)=>setSlot({...slot, start_time:e.target.value})}/></div>
              <div><Label>Fim</Label><Input type="time" value={slot.end_time} onChange={(e)=>setSlot({...slot, end_time:e.target.value})}/></div>
              <div><Label>Profissional</Label>
                <Select value={slot.professional} onValueChange={(v)=>setSlot({...slot, professional:v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger>
                  <SelectContent>{professionals.map(p=><SelectItem key={p.id} value={p.name}>{p.name} {p.role && `(${p.role})`}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Sala</Label><Input value={slot.room} onChange={(e)=>setSlot({...slot, room:e.target.value})}/></div>
              <div><Label>Tipo de terapia</Label><Input value={slot.therapy_type} onChange={(e)=>setSlot({...slot, therapy_type:e.target.value})}/></div>
              <div className="sm:col-span-3"><Button onClick={addSlot}><Plus className="h-4 w-4 mr-1"/>Adicionar</Button></div>
            </CardContent>
          </Card>
          )}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Quadro da Grade</CardTitle>
              <Badge variant="secondary">Carga Horária Total: {calculateWorkload()}</Badge>
            </CardHeader>
            <CardContent className="p-0">
            {slots.length === 0 ? <p className="p-6 text-center text-muted-foreground">Sem horários.</p> :
              <div className="divide-y">{slots.map((s)=>(
                <div key={s.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{weekdays.find(([k])=>k===s.weekday)?.[1]} {s.start_time?.slice(0,5)}-{s.end_time?.slice(0,5)}</span>
                    {" · "}{s.professional}{s.room && ` · Sala ${s.room}`}{s.therapy_type && ` · ${s.therapy_type}`}
                  </div>
                  {canEditPatients && <Button size="sm" variant="ghost" onClick={()=>removeSlot(s.id)}><Trash2 className="h-4 w-4"/></Button>}
                </div>
              ))}</div>
            }
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          {canEditPatients && (
          <Card>
            <CardHeader><CardTitle className="text-base">Enviar documento (PDF até 100MB)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título</Label><Input value={doc.title} onChange={(e)=>setDoc({...doc, title:e.target.value})}/></div>
              <div><Label>Tipo</Label>
                <Select value={doc.doc_type} onValueChange={(v: any)=>setDoc({...doc, doc_type:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="therapy_plan">Planejamento Terapêutico</SelectItem>
                    <SelectItem value="semester_report">Relatório Semestral</SelectItem>
                    <SelectItem value="aba_report">Relatório ABA</SelectItem>
                    <SelectItem value="medical_request">Pedido Médico (Laudo)</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {doc.doc_type === "medical_request" && (
                <div><Label>Data do Pedido (Laudo)</Label><Input type="date" value={medicalDate} onChange={(e)=>setMedicalDate(e.target.value)} /></div>
              )}
              <div><Label>Arquivo</Label><Input type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files?.[0] ?? null)}/></div>
              <Button onClick={uploadDoc} disabled={uploading}><UploadIcon className="h-4 w-4 mr-1"/>{uploading?"Enviando...":"Enviar"}</Button>
            </CardContent>
          </Card>
          )}
          <Card><CardContent className="p-0">
            {docs.length === 0 ? <p className="p-6 text-center text-muted-foreground">Sem documentos.</p> :
              <div className="divide-y">{docs.map((d)=>(
                <div key={d.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.doc_type} · {d.size_bytes && `${(d.size_bytes/1024/1024).toFixed(1)} MB`}</p>
                  </div>
                  {canEditPatients && <Button size="sm" variant="ghost" onClick={()=>removeDoc(d)}><Trash2 className="h-4 w-4"/></Button>}
                </div>
              ))}</div>
            }
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
