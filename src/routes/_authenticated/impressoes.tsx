import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Search, FileText, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/impressoes")({
  head: () => ({ meta: [{ title: "Impressões — ACT Sublime" }] }),
  component: ImpressoesHub,
});

const isFilled = (s: any) => {
  if (!s) return false;
  const c = new Date(s.created_at).getTime();
  const u = new Date(s.updated_at).getTime();
  return u - c > 1500;
};

function ImpressoesHub() {
  const { isRespTecnicoOrAdmin } = useAuth();
  if (!isRespTecnicoOrAdmin) return <Navigate to="/dashboard" />;
  const [q, setQ] = useState("");
  const [unitId, setUnitId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [readiness, setReadiness] = useState<string>("all");

  const { data: units } = useQuery({
    queryKey: ["units-all"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports-print-hub"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, title, status, period_start, period_end, updated_at, patient_id, patients(id, full_name, unit_id, units(name))")
        .in("status", ["em_revisao", "aprovado_diretoria", "liberado_pais"] as any)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const reportIds = useMemo(() => (reports ?? []).map((r: any) => r.id), [reports]);
  const patientIds = useMemo(
    () => Array.from(new Set((reports ?? []).map((r: any) => r.patient_id).filter(Boolean))),
    [reports],
  );

  const { data: allSections } = useQuery({
    queryKey: ["impressoes-sections", reportIds.length],
    enabled: reportIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sections")
        .select("id, report_id, specialty_id, content, field_values, created_at, updated_at, specialties(name, color), professionals(full_name)")
        .in("report_id", reportIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allGrid } = useQuery({
    queryKey: ["impressoes-grid", patientIds.length],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapy_grid")
        .select("patient_id, specialty_id, specialties(name, color)")
        .in("patient_id", patientIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const progressByReport = useMemo(() => {
    const map = new Map<string, {
      required: Map<string, { name: string; color?: string }>;
      filled: Set<string>;
      pending: { id: string; name: string; color?: string }[];
      filledList: { id: string; name: string; color?: string }[];
    }>();

    (reports ?? []).forEach((r: any) => {
      const req = new Map<string, { name: string; color?: string }>();
      (allGrid ?? [])
        .filter((g: any) => g.patient_id === r.patient_id && g.specialty_id)
        .forEach((g: any) => {
          req.set(g.specialty_id, {
            name: g.specialties?.name ?? "—",
            color: g.specialties?.color,
          });
        });
      const filled = new Set<string>();
      (allSections ?? [])
        .filter((s: any) => s.report_id === r.id && s.specialty_id && isFilled(s))
        .forEach((s: any) => filled.add(s.specialty_id));

      const pending = Array.from(req.entries())
        .filter(([sid]) => !filled.has(sid))
        .map(([sid, v]) => ({ id: sid, ...v }));
      const filledList = Array.from(req.entries())
        .filter(([sid]) => filled.has(sid))
        .map(([sid, v]) => ({ id: sid, ...v }));

      map.set(r.id, { required: req, filled, pending, filledList });
    });
    return map;
  }, [reports, allSections, allGrid]);

  const filtered = useMemo(() => {
    return (reports ?? []).filter((r: any) => {
      if (status !== "all" && r.status !== status) return false;
      if (unitId !== "all" && r.patients?.unit_id !== unitId) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const hay = `${r.title ?? ""} ${r.patients?.full_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const prog = progressByReport.get(r.id);
      const total = prog?.required.size ?? 0;
      const done = prog?.filled.size ?? 0;
      const complete = total > 0 && done === total;
      if (readiness === "ready" && !(complete && (r.status === "aprovado_diretoria" || r.status === "liberado_pais"))) return false;
      if (readiness === "to_review" && !(complete && r.status !== "aprovado_diretoria" && r.status !== "liberado_pais")) return false;
      if (readiness === "incomplete" && complete) return false;
      return true;
    });
  }, [reports, q, unitId, status, readiness, progressByReport]);

  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Printer className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Impressões</h1>
          <p className="text-sm text-muted-foreground">
            Monte documentos personalizados: escolha o relatório, defina o que deve aparecer e gere a versão para imprimir ou enviar.
          </p>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por paciente ou título"
            className="pl-8"
          />
        </div>
        <Select value={unitId} onValueChange={setUnitId}>
          <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas unidades</SelectItem>
            {units?.map((u: any) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="em_revisao">Em revisão</SelectItem>
            <SelectItem value="aprovado_diretoria">Aprovado pela Diretoria</SelectItem>
            <SelectItem value="liberado_pais">Liberado aos pais</SelectItem>
          </SelectContent>
        </Select>
        <Select value={readiness} onValueChange={setReadiness}>
          <SelectTrigger><SelectValue placeholder="Prontidão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="incomplete">Faltando preencher</SelectItem>
            <SelectItem value="to_review">Prontos para revisar</SelectItem>
            <SelectItem value="ready">Liberados / prontos para imprimir</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum relatório encontrado com esses filtros.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((r: any) => {
              const prog = progressByReport.get(r.id);
              const total = prog?.required.size ?? 0;
              const done = prog?.filled.size ?? 0;
              const complete = total > 0 && done === total;
              const released = r.status === "aprovado_diretoria" || r.status === "liberado_pais";
              return (
                <li key={r.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{r.title}</span>
                      <Badge variant="outline" className="text-[10px]">{statusLabel(r.status)}</Badge>
                      {total > 0 ? (
                        <Badge
                          variant={complete ? "default" : "secondary"}
                          className={`text-[10px] ${complete ? "bg-emerald-600 hover:bg-emerald-600" : ""}`}
                        >
                          {complete ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> {done}/{total} áreas preenchidas</>
                          ) : (
                            <><AlertTriangle className="h-3 w-3 mr-1" /> {done}/{total} áreas preenchidas</>
                          )}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-800">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Sem grade terapêutica
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                      <span>{r.patients?.full_name ?? "—"}</span>
                      {r.patients?.units?.name && <span>· {r.patients.units.name}</span>}
                      <span>· {fmt(r.period_start)} a {fmt(r.period_end)}</span>
                    </div>
                    {prog && (prog.pending.length > 0 || prog.filledList.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {prog.filledList.map((s) => (
                          <span
                            key={`f-${s.id}`}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700"
                            title="Preenchido"
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color ?? "#10b981" }} />
                            {s.name}
                          </span>
                        ))}
                        {prog.pending.map((s) => (
                          <span
                            key={`p-${s.id}`}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-700"
                            title="Pendente"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            {s.name} · pendente
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button asChild size="sm" variant={released ? "default" : "outline"}>
                      <Link to="/reports/$reportId/print" params={{ reportId: r.id }}>
                        {released ? (
                          <><Printer className="h-4 w-4 mr-1" /> Montar impressão</>
                        ) : (
                          <><Eye className="h-4 w-4 mr-1" /> Pré-visualizar</>
                        )}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function statusLabel(s: string) {
  return ({
    rascunho: "Rascunho",
    em_revisao: "Em revisão",
    aprovado_diretoria: "Aprovado",
    liberado_pais: "Liberado",
  } as Record<string, string>)[s] ?? s;
}
