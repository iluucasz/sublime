import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-shell";
import { Download, Loader2 } from "lucide-react";

const TABLES = [
  "announcement_reads",
  "announcement_replies",
  "announcements",
  "assessment_applications",
  "assessment_items",
  "assessment_results",
  "assessments",
  "case_studies",
  "edit_audit_log",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "goals",
  "operators",
  "patient_documents",
  "patients",
  "professionals",
  "profiles",
  "report_audit_log",
  "report_section_signers",
  "report_sections",
  "report_signers",
  "report_template_modules",
  "report_templates",
  "reports",
  "specialties",
  "suppressed_emails",
  "therapy_grid",
  "units",
  "user_roles",
];

export const Route = createFileRoute("/_authenticated/dump/")({
  head: () => ({ meta: [{ title: "Exportar Dados — ACT Sublime" }] }),
  component: DumpPage,
});

function DumpPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [summary, setSummary] = useState<{ table: string; rows: number; error?: string }[]>([]);

  async function runDump() {
    setLoading(true);
    setProgress("Iniciando...");
    setResult(null);
    setSummary([]);

    const data: Record<string, any> = {};
    const sum: { table: string; rows: number; error?: string }[] = [];

    for (const table of TABLES) {
      setProgress(`Exportando ${table}...`);
      const allRows: any[] = [];
      const pageSize = 1000;
      let start = 0;

      try {
        while (true) {
          const { data: rows, error } = await supabase
            .from(table)
            .select("*")
            .range(start, start + pageSize - 1);

          if (error) {
            sum.push({ table, rows: 0, error: error.message });
            break;
          }
          if (!rows || rows.length === 0) break;
          allRows.push(...rows);
          start += rows.length;
          if (rows.length < pageSize) break;
        }

        if (!sum.find((s) => s.table === table)) {
          sum.push({ table, rows: allRows.length });
        }
        data[table] = allRows;
      } catch (e: any) {
        sum.push({ table, rows: 0, error: e.message });
        data[table] = [];
      }
    }

    const totalRows = sum.reduce((acc, s) => acc + (s.error ? 0 : s.rows), 0);
    data._summary = { exported_at: new Date().toISOString(), total_rows: totalRows, tables: sum };

    setResult(data);
    setSummary(sum);
    setProgress("Concluido!");

    // Auto-download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `db_dump_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Exportar Banco de Dados" description="Baixe todos os dados de todas as tabelas em um arquivo JSON." />

      <Card>
        <CardHeader>
          <CardTitle>Exportar tudo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Isso vai consultar todas as {TABLES.length} tabelas do banco e gerar um arquivo JSON com todos os registros.
            O download começa automaticamente ao finalizar.
          </p>

          <Button onClick={runDump} disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar tudo
              </>
            )}
          </Button>

          {summary.length > 0 && (
            <div className="mt-4 border rounded-md p-4 max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">Tabela</th>
                    <th className="text-right py-1">Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.table} className="border-b last:border-0">
                      <td className="py-1">{s.table}</td>
                      <td className={`text-right py-1 ${s.error ? "text-red-500" : ""}`}>
                        {s.error ? `ERRO: ${s.error}` : s.rows}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="py-1">Total</td>
                    <td className="text-right py-1">
                      {summary.reduce((acc, s) => acc + (s.error ? 0 : s.rows), 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
