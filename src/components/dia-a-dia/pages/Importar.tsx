import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";

interface Row { child_name?: string; admission_date?: string; notes?: string; nome?: string; admissao?: string; observacoes?: string; }

export default function Importar() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
        setRows(data);
        toast.success(`${data.length} linhas lidas`);
      } catch (err: any) { toast.error("Erro ao ler arquivo: " + err.message); }
    };
    reader.readAsBinaryString(file);
  };

  const normalize = (r: Row) => ({
    child_name: String(r.child_name || r.nome || "").trim(),
    admission_date: r.admission_date || r.admissao ? new Date(r.admission_date || r.admissao!).toISOString().slice(0,10) : null,
    notes: String(r.notes || r.observacoes || "").trim() || null,
  });

  const importAll = async () => {
    const valid = rows.map(normalize).filter((r) => r.child_name);
    if (valid.length === 0) return toast.error("Nenhuma linha válida");
    setBusy(true);
    const { error } = await supabase.from("dd_patients").insert(valid);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(`${valid.length} pacientes importados`); setRows([]); }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ nome: "Exemplo Criança", admissao: "2024-01-15", observacoes: "" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pacientes");
    XLSX.writeFile(wb, "modelo-pacientes.xlsx");
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-sublime-navy">Importar Pacientes via Planilha</h1>
        <p className="text-sm text-muted-foreground">Upload de Excel (.xlsx) ou CSV. Colunas aceitas: <code>nome</code>, <code>admissao</code>, <code>observacoes</code>.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Baixe o modelo (opcional)</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1"/>Baixar modelo .xlsx</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. Selecione a planilha</CardTitle></CardHeader>
        <CardContent>
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={onFile}/>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4"/>Pré-visualização ({rows.length} linhas)</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-auto text-xs border rounded-md mb-3">
              <table className="w-full">
                <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Admissão</th></tr></thead>
                <tbody>{rows.slice(0,20).map((r,i) => {
                  const n = normalize(r);
                  return <tr key={i} className="border-t"><td className="p-2">{n.child_name}</td><td className="p-2">{n.admission_date ?? "—"}</td></tr>;
                })}</tbody>
              </table>
            </div>
            <Button onClick={importAll} disabled={busy}><Upload className="h-4 w-4 mr-1"/>{busy?"Importando...":`Importar ${rows.length} pacientes`}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
