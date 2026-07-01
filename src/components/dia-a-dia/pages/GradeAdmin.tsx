import { useEffect, useState } from "react";
import { supabase } from "../db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface Patient { id: string; child_name: string; }
interface Slot { id: string; weekday: string; start_time: string; end_time: string; professional: string; room: string | null; therapy_type: string | null; }

const weekdays = ["monday","tuesday","wednesday","thursday","friday","saturday"];
const labels: Record<string, string> = { monday:"Segunda", tuesday:"Terça", wednesday:"Quarta", thursday:"Quinta", friday:"Sexta", saturday:"Sábado", sunday:"Domingo" };

export default function GradeAdmin() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("dd_patients").select("id,child_name").order("child_name").then(({ data, error }: any) => {
      if (error) { toast.error(error.message); return; }
      setPatients(data ?? []);
      if (data?.[0]) setSelected(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) { setSlots([]); return; }
    setLoading(true);
    supabase.from("dd_therapy_schedule").select("*").eq("patient_id", selected).order("start_time").then(({ data, error }: any) => {
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      setSlots((data as Slot[]) ?? []);
    });
  }, [selected]);

  const times = Array.from(new Set(slots.map((s) => `${s.start_time || ""}-${s.end_time || ""}`))).sort();
  const matrix: Record<string, Record<string, Slot | undefined>> = {};
  times.forEach((t) => { matrix[t] = {}; weekdays.forEach((d) => matrix[t][d] = undefined); });
  slots.forEach((s) => { matrix[`${s.start_time || ""}-${s.end_time || ""}`][s.weekday] = s; });

  const childName = patients.find((p) => p.id === selected)?.child_name ?? "";

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16); doc.text(`Grade Terapêutica - ${childName}`, 14, 15);
    doc.setFontSize(10); doc.text(`Sublime - Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Horário", ...weekdays.map((d) => labels[d])]],
      body: times.map((t) => [t.replace("-", " - ").slice(0,13), ...weekdays.map((d) => {
        const s = matrix[t][d];
        return s ? `${s.professional}\n${s.room ?? ""}\n${s.therapy_type ?? ""}` : "—";
      })]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [54, 70, 130] },
    });
    doc.save(`grade-${childName}.pdf`);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sublime-navy">Grade Terapêutica</h1>
          <p className="text-sm text-muted-foreground">Selecione um paciente para visualizar a grade</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()} disabled={!slots.length}><Printer className="h-4 w-4 mr-1"/>Imprimir</Button>
          <Button onClick={exportPDF} disabled={!slots.length}><Download className="h-4 w-4 mr-1"/>Salvar PDF</Button>
        </div>
      </div>

      {patients.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum paciente cadastrado.</CardContent></Card>
      ) : (
        <>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Selecione um paciente"/></SelectTrigger>
            <SelectContent>
              {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.child_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Card>
            <CardHeader><CardTitle>{childName || "—"}</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : times.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum horário cadastrado para este paciente.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Horário</TableHead>
                        {weekdays.map((d) => <TableHead key={d}>{labels[d]}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {times.map((t) => (
                        <TableRow key={t}>
                          <TableCell className="font-medium">{t.replace("-", " - ").slice(0,13)}</TableCell>
                          {weekdays.map((d) => {
                            const s = matrix[t][d];
                            return (
                              <TableCell key={d} className="text-xs align-top">
                                {s ? (
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-sublime-navy">{s.professional}</div>
                                    {s.room && <div className="text-muted-foreground">Sala: {s.room}</div>}
                                    {s.therapy_type && <div className="text-sublime-blue">{s.therapy_type}</div>}
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
