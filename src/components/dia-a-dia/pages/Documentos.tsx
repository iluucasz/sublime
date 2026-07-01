import { useEffect, useState } from "react";
import { supabase } from "../db";
import { useDiaNav } from "../DiaNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

interface Doc { id: string; title: string; doc_type: string; storage_path: string; size_bytes: number | null; created_at: string; patient_id: string; dd_patients?: { child_name: string } }
const typeLabels: Record<string, string> = {
  therapy_plan: "Planejamento Terapêutico",
  semester_report: "Relatório Semestral",
  aba_report: "Relatório ABA",
  medical_request: "Pedido Médico (Laudo)",
  other: "Outro",
};
const typeColors: Record<string, string> = {
  therapy_plan: "bg-sublime-blue/20 text-sublime-navy",
  semester_report: "bg-sublime-yellow/30 text-sublime-navy",
  aba_report: "bg-sublime-pink/20 text-sublime-navy",
  medical_request: "bg-red-100 text-red-800",
  other: "bg-muted",
};

export default function Documentos() {
  const { params } = useDiaNav();
  const routeType = params.type;
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    let query = supabase.from("dd_documents").select("*, dd_patients(child_name)").order("created_at", { ascending: false });
    if (routeType) query = query.eq("doc_type", routeType);
    query.then(({ data }: any) => setDocs((data as any) ?? []));
  }, [routeType]);

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60);
    if (error || !data) return toast.error("Erro ao baixar arquivo");
    window.open(data.signedUrl, "_blank");
  };

  const grouped = docs.reduce<Record<string, Doc[]>>((acc, d) => {
    (acc[d.doc_type] ||= []).push(d); return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-sublime-navy">Documentos</h1>
        <p className="text-sm text-muted-foreground">Relatórios, planejamentos e demais arquivos enviados pela clínica</p>
      </div>

      {docs.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum documento disponível ainda.</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([type, list]) => (
          <Card key={type}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">
              <Badge className={typeColors[type]}>{typeLabels[type]}</Badge>
            </CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {list.map((d) => (
                <div key={d.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-accent/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-sublime-blue shrink-0"/>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                        {d.dd_patients?.child_name && ` · ${d.dd_patients.child_name}`}
                        {d.size_bytes && ` · ${(d.size_bytes / 1024 / 1024).toFixed(1)} MB`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => download(d)}>
                    <Download className="h-4 w-4 mr-1"/>Baixar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
