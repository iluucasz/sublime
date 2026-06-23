import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, NewItemDialog, NewButton } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Trash2, ArrowLeft, Filter } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/grade")({
  head: () => ({ meta: [{ title: "Grade Terapêutica — ACT Sublime" }] }),
  component: PatientGradePage,
});

const WEEKDAYS = [
  { value: 1, label: "Segunda-feira", short: "SEG" },
  { value: 2, label: "Terça-feira", short: "TER" },
  { value: 3, label: "Quarta-feira", short: "QUA" },
  { value: 4, label: "Quinta-feira", short: "QUI" },
  { value: 5, label: "Sexta-feira", short: "SEX" },
];

const emptyForm = {
  specialty_id: "",
  professional_id: "",
  weekday: "" as string,
  start_time: "",
  duration_minutes: 45,
  integrated_note: "",
  notes: "",
};

function minutesToHHMM(min: number) {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  return minutesToHHMM(h * 60 + m + minutes);
}

function PatientGradePage() {
  const { patientId } = Route.useParams();
  const qc = useQueryClient();
  const { isRespTecnicoOrAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  const now = new Date();
  const [filterYear, setFilterYear] = useState<string>(String(now.getFullYear()));
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => (await supabase.from("patients").select("*, units(name)").eq("id", patientId).maybeSingle()).data,
  });

  const { data: grid, isLoading } = useQuery({
    queryKey: ["therapy_grid", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapy_grid")
        .select("*, specialties(name, color), professionals(full_name)")
        .eq("patient_id", patientId)
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: specialties } = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => (await supabase.from("specialties").select("*").order("name")).data ?? [],
  });
  const { data: professionals } = useQuery({
    queryKey: ["professionals", "active"],
    queryFn: async () => (await supabase.from("professionals").select("id, full_name, specialty_id").eq("status", "ativo").order("full_name")).data ?? [],
  });

  const addM = useMutation({
    mutationFn: async () => {
      if (!form.specialty_id) throw new Error("Selecione a especialidade");
      if (!form.weekday) throw new Error("Selecione o dia da semana");
      if (!form.start_time) throw new Error("Informe o horário");
      const payload: any = {
        patient_id: patientId,
        specialty_id: form.specialty_id,
        professional_id: form.professional_id || null,
        weekday: Number(form.weekday),
        start_time: form.start_time,
        duration_minutes: Number(form.duration_minutes) || 45,
        integrated_note: form.integrated_note || null,
        notes: form.notes || null,
      };
      const { error } = await supabase.from("therapy_grid").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sessão adicionada à grade");
      qc.invalidateQueries({ queryKey: ["therapy_grid"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("therapy_grid").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sessão removida");
      qc.invalidateQueries({ queryKey: ["therapy_grid"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredPros = form.specialty_id
    ? professionals?.filter((p) => p.specialty_id === form.specialty_id)
    : professionals;

  const filtered = useMemo(() => {
    return (grid ?? []).filter((g: any) => {
      if (filterSpecialty !== "all" && g.specialty_id !== filterSpecialty) return false;
      if (filterProfessional !== "all" && g.professional_id !== filterProfessional) return false;
      return true;
    });
  }, [grid, filterSpecialty, filterProfessional]);

  const byDay = useMemo(() => {
    const map: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const item of filtered) {
      if (item.weekday && map[item.weekday]) map[item.weekday].push(item);
    }
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")),
    );
    return map;
  }, [filtered]);

  return (
    <div>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/patients"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar para pacientes</Link>
        </Button>
      </div>
      <PageHeader
        title={`Grade Terapêutica — ${patient?.full_name ?? ""}`}
        description={patient?.units?.name ? `Unidade: ${patient.units.name}` : "Sessões semanais agendadas"}
        action={isRespTecnicoOrAdmin && <NewButton onClick={() => { setForm(emptyForm); setOpen(true); }} label="Adicionar sessão" />}
      />

      <NewItemDialog
        title="Adicionar sessão à grade"
        open={open}
        onOpenChange={setOpen}
        onSubmit={() => addM.mutateAsync()}
        submitting={addM.isPending}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Especialidade *</Label>
            <Select value={form.specialty_id} onValueChange={(v) => setForm({ ...form, specialty_id: v, professional_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{specialties?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Profissional</Label>
            <Select value={form.professional_id} onValueChange={(v) => setForm({ ...form, professional_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{filteredPros?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dia da semana *</Label>
            <Select value={form.weekday} onValueChange={(v) => setForm({ ...form, weekday: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Horário *</Label>
            <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Duração (min)</Label>
            <Input type="number" min={15} step={15} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Integrado com</Label>
            <Input placeholder="Ex.: FISIO, ABA…" value={form.integrated_note} onChange={(e) => setForm({ ...form, integrated_note: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </NewItemDialog>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Filter className="h-4 w-4" /> Filtros
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Especialidade</Label>
            <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {specialties?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Profissional</Label>
            <Select value={filterProfessional} onValueChange={setFilterProfessional}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {professionals?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Semestre</Label>
            <Select value={filterSemester} onValueChange={setFilterSemester}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="1">1º semestre</SelectItem>
                <SelectItem value="2">2º semestre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {(filterSpecialty !== "all" || filterProfessional !== "all" || filterMonth !== "all" || filterSemester !== "all" || filterYear !== String(now.getFullYear())) && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={() => {
              setFilterSpecialty("all"); setFilterProfessional("all");
              setFilterMonth("all"); setFilterSemester("all"); setFilterYear(String(now.getFullYear()));
            }}>Limpar filtros</Button>
          </div>
        )}
      </Card>


      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Carregando…</Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState title="Grade vazia" description="Nenhuma sessão agendada para este paciente." /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {WEEKDAYS.map((day) => (
            <Card key={day.value} className="p-3 flex flex-col min-h-[200px]">
              <div className="text-sm font-semibold text-primary mb-2 pb-2 border-b">
                {day.label}
              </div>
              <div className="space-y-2 flex-1">
                {byDay[day.value].length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">Sem sessões</div>
                ) : (
                  byDay[day.value].map((g: any) => {
                    const color = g.specialties?.color || "hsl(var(--primary))";
                    const end = g.start_time ? addMinutes(g.start_time.slice(0, 5), g.duration_minutes || 45) : null;
                    return (
                      <div
                        key={g.id}
                        className="rounded-md p-2 text-xs border-l-4 bg-muted/40 group relative"
                        style={{ borderLeftColor: color }}
                      >
                        <div className="font-mono font-semibold">
                          {g.start_time?.slice(0, 5)}{end && ` – ${end}`}
                        </div>
                        <div className="font-medium uppercase mt-0.5" style={{ color }}>
                          {g.specialties?.name ?? "—"}
                        </div>
                        {g.professionals?.full_name && (
                          <div className="text-muted-foreground">{g.professionals.full_name}</div>
                        )}
                        {g.integrated_note && (
                          <div className="text-[10px] mt-1 italic text-muted-foreground">
                            Integrado com {g.integrated_note}
                          </div>
                        )}
                        {g.notes && (
                          <div className="text-[10px] mt-1 text-muted-foreground">{g.notes}</div>
                        )}
                        {isRespTecnicoOrAdmin && (
                          <button
                            onClick={() => { if (confirm("Remover esta sessão?")) delM.mutate(g.id); }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-destructive"
                            aria-label="Remover"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
