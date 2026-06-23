import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";

type ParsedSession = {
  weekday: number;
  start_time: string;
  specialty_raw: string;
  professional_raw: string;
  integrated_note?: string;
  specialty_id?: string;
  professional_id?: string;
};

type ParsedRow = {
  raw_name: string;
  normalized: string;
  patient_id?: string;
  patient_suggestion?: { id: string; full_name: string }[];
  sessions: ParsedSession[];
};

const WEEKDAYS: Record<string, number> = {
  DOMINGO: 0, "SEGUNDA-FEIRA": 1, SEGUNDA: 1, "TERCA-FEIRA": 2, "TERÇA-FEIRA": 2, TERCA: 2, TERÇA: 2,
  "QUARTA-FEIRA": 3, QUARTA: 3, "QUINTA-FEIRA": 4, QUINTA: 4, "SEXTA-FEIRA": 5, SEXTA: 5, SABADO: 6, SÁBADO: 6,
};

// longest specialties first so "TERAPIA OCUPACIONAL" wins over partial matches
const SPECIALTY_TOKENS = [
  "SALA DE THS",
  "AVALIACAO NEUROPSICOLOGICA",
  "COZINHA TERAPEUTICA",
  "TERAPIA OCUPACIONAL",
  "TERAPIA ALIMENTAR",
  "PSICOMOTRICIDADE",
  "PSICOPEDAGOGIA",
  "FONOAUDIOLOGIA",
  "MUSICOTERAPIA",
  "FISIOTERAPIA",
  "PSICOLOGIA",
  "DENVER",
  "ABA",
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

function parseCSV(text: string): { name: string; grade: string }[] {
  const rows: { name: string; grade: string }[] = [];
  let i = 0;
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  const pushRow = () => {
    fields.push(cur);
    if (fields.length >= 2 && (fields[0] || fields[1])) rows.push({ name: fields[0], grade: fields[1] });
    fields.length = 0;
    cur = "";
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cur += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { fields.push(cur); cur = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { pushRow(); i++; continue; }
    cur += c; i++;
  }
  if (cur || fields.length) pushRow();
  // drop header
  return rows.filter((r) => norm(r.name) !== "PACIENTE");
}

function parseGradeBlock(block: string): ParsedSession[] {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  let currentDay: number | null = null;
  const sessions: ParsedSession[] = [];
  for (const line of lines) {
    const up = norm(line);
    // Weekday header?
    const dayKey = Object.keys(WEEKDAYS).find((d) => up === d || up.startsWith(d));
    if (dayKey && !/\d/.test(up)) {
      currentDay = WEEKDAYS[dayKey];
      continue;
    }
    // session line: HH:MM ...
    const m = line.match(/^(\d{1,2})[:hH](\d{2})\s+(.+)$/);
    if (!m || currentDay === null) continue;
    const hh = m[1].padStart(2, "0");
    const mm = m[2];
    let rest = m[3];
    let integrated: string | undefined;
    const intIdx = rest.search(/[—–-]\s*INTEGRADO/i);
    if (intIdx >= 0) {
      integrated = rest.slice(intIdx).replace(/^[—–\-\s]+/, "").trim();
      rest = rest.slice(0, intIdx).trim();
    }
    const restNorm = norm(rest);
    const spec = SPECIALTY_TOKENS.find((s) => restNorm.startsWith(s));
    if (!spec) continue;
    const prof = restNorm.slice(spec.length).trim();
    sessions.push({
      weekday: currentDay,
      start_time: `${hh}:${mm}`,
      specialty_raw: spec,
      professional_raw: prof,
      integrated_note: integrated,
    });
  }
  return sessions;
}

// simple Levenshtein for suggestions
function distance(a: string, b: string): number {
  const dp = Array(b.length + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function ImportGradesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const { data: patients } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => (await supabase.from("patients").select("id, full_name")).data ?? [],
  });
  const { data: specialties } = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => (await supabase.from("specialties").select("id, name")).data ?? [],
  });
  const { data: professionals } = useQuery({
    queryKey: ["professionals-min"],
    queryFn: async () => (await supabase.from("professionals").select("id, full_name, specialty_id")).data ?? [],
  });

  const specByToken = useMemo(() => {
    const m: Record<string, string> = {};
    if (!specialties) return m;
    const find = (n: string) => specialties.find((s) => norm(s.name) === norm(n))?.id;
    m["SALA DE THS"] = find("Sala de THS") ?? "";
    m["AVALIACAO NEUROPSICOLOGICA"] = find("Avaliação Neuropsicológica") ?? "";
    m["COZINHA TERAPEUTICA"] = find("Cozinha Terapêutica") ?? "";
    m["TERAPIA OCUPACIONAL"] = find("Terapia Ocupacional") ?? "";
    m["TERAPIA ALIMENTAR"] = find("Terapia Alimentar") ?? "";
    m["PSICOMOTRICIDADE"] = find("Psicomotricidade") ?? "";
    m["PSICOPEDAGOGIA"] = find("Psicopedagogia") ?? "";
    m["FONOAUDIOLOGIA"] = find("Fonoaudiologia") ?? "";
    m["MUSICOTERAPIA"] = find("Musicoterapia") ?? "";
    m["FISIOTERAPIA"] = find("Fisioterapia") ?? "";
    m["PSICOLOGIA"] = find("Psicologia") ?? "";
    m["DENVER"] = find("Denver") ?? "";
    m["ABA"] = find("ABA") ?? "";
    return m;
  }, [specialties]);

  async function onFile(f: File) {
    setFile(f);
    const text = await f.text();
    const csv = parseCSV(text);
    const pNorm = (patients ?? []).map((p) => ({ ...p, n: norm(p.full_name) }));
    const parsed: ParsedRow[] = csv.map(({ name, grade }) => {
      const n = norm(name);
      const exact = pNorm.find((p) => p.n === n);
      const sessions = parseGradeBlock(grade).map((s) => {
        const specialty_id = specByToken[s.specialty_raw] || undefined;
        // match professional by first name + same specialty if possible
        const profFirst = s.professional_raw.split(" ")[0];
        const candidates = (professionals ?? []).filter((p) => {
          const pn = norm(p.full_name);
          return pn.startsWith(profFirst);
        });
        const best = candidates.find((c) => c.specialty_id === specialty_id) || candidates[0];
        return { ...s, specialty_id, professional_id: best?.id };
      });
      let suggestions: { id: string; full_name: string }[] | undefined;
      if (!exact) {
        suggestions = pNorm
          .map((p) => ({ p, d: distance(p.n, n) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 5)
          .map((x) => ({ id: x.p.id, full_name: x.p.full_name }));
      }
      return { raw_name: name.trim(), normalized: n, patient_id: exact?.id, patient_suggestion: suggestions, sessions };
    });
    setRows(parsed);
  }

  function setRowPatient(idx: number, id: string) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, patient_id: id } : row)));
  }

  const matched = rows.filter((r) => r.patient_id).length;
  const totalSessions = rows.reduce((acc, r) => acc + (r.patient_id ? r.sessions.length : 0), 0);

  const importM = useMutation({
    mutationFn: async () => {
      const payload = rows
        .filter((r) => r.patient_id)
        .flatMap((r) =>
          r.sessions
            .filter((s) => s.specialty_id)
            .map((s) => ({
              patient_id: r.patient_id!,
              specialty_id: s.specialty_id!,
              professional_id: s.professional_id ?? null,
              weekday: s.weekday,
              start_time: s.start_time,
              duration_minutes: 45,
              integrated_note: s.integrated_note ?? null,
              notes: null,
            })),
        );
      if (!payload.length) throw new Error("Nada para importar");
      // Upsert por paciente: apaga a grade atual dos pacientes importados e insere as novas sessões
      const patientIds = Array.from(new Set(payload.map((p) => p.patient_id)));
      const { error: delErr } = await supabase.from("therapy_grid").delete().in("patient_id", patientIds);
      if (delErr) throw delErr;
      const chunkSize = 200;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const { error } = await supabase.from("therapy_grid").insert(payload.slice(i, i + chunkSize));
        if (error) throw error;
      }
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} sessões importadas`);
      qc.invalidateQueries({ queryKey: ["therapy-grid"] });
      onOpenChange(false);
      setRows([]); setFile(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Importar grades terapêuticas (CSV)</DialogTitle></DialogHeader>
        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="max-w-sm"
            />
            {file && (
              <span className="text-sm text-muted-foreground">
                {file.name} — {rows.length} pacientes | {matched} reconhecidos | {totalSessions} sessões
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Formato esperado: colunas <code>PACIENTE,GRADE</code>. A grade pode conter quebras de linha por dia
            (SEGUNDA-FEIRA, TERÇA-FEIRA…) e linhas <code>HH:MM ESPECIALIDADE PROFISSIONAL</code>.
            Nomes diferentes do cadastro podem ser ajustados manualmente na coluna "De/Para".
          </p>

          {rows.length > 0 && (
            <div className="flex-1 min-h-0 overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2 w-8"></th>
                    <th className="text-left p-2">Paciente no CSV</th>
                    <th className="text-left p-2 w-[320px]">De/Para (paciente do sistema)</th>
                    <th className="text-left p-2">Sessões</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-t align-top">
                      <td className="p-2">
                        {r.patient_id
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          : <AlertCircle className="h-4 w-4 text-amber-600" />}
                      </td>
                      <td className="p-2 font-medium">{r.raw_name}</td>
                      <td className="p-2">
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={r.patient_id ?? ""}
                          onChange={(e) => setRowPatient(idx, e.target.value)}
                        >
                          <option value="">— selecionar —</option>
                          {(r.patient_suggestion ?? []).length > 0 && (
                            <optgroup label="Sugestões">
                              {r.patient_suggestion!.map((s) => (
                                <option key={`sug-${s.id}`} value={s.id}>★ {s.full_name}</option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Todos os pacientes">
                            {(patients ?? []).map((p) => (
                              <option key={p.id} value={p.id}>{p.full_name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {r.sessions.map((s, i) => (
                            <Badge key={i} variant={s.specialty_id ? "secondary" : "outline"} className="text-xs">
                              {["DOM","SEG","TER","QUA","QUI","SEX","SAB"][s.weekday]} {s.start_time} {s.specialty_raw}
                              {s.professional_id ? "" : s.professional_raw ? ` ⚠${s.professional_raw}` : ""}
                            </Badge>
                          ))}
                          {r.sessions.length === 0 && <span className="text-xs text-muted-foreground">nenhuma sessão reconhecida</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => importM.mutate()} disabled={!matched || importM.isPending}>
            <Upload className="h-4 w-4 mr-1" />
            {importM.isPending ? "Importando…" : `Importar ${totalSessions} sessões`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
