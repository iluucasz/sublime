import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Mail, Sparkles, Loader2, CheckCircle2, AlertTriangle, Send, ShieldCheck, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/sublime-logo.png";
import subliminho from "@/assets/subliminho.png";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { sendReportEmail } from "@/lib/report-email.functions";
import { reviewSectionWithAI } from "@/lib/ai-review.functions";
import { OBJECTIVE_LEVELS, type FormField } from "@/components/form-fields";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/reports/$reportId/print")({
  head: () => ({ meta: [{ title: "Montar impressão — ACT Sublime" }] }),
  component: PrintReportPage,
});

function PrintReportPage() {
  const { reportId } = Route.useParams();

  const { data: report } = useQuery({
    queryKey: ["report-print", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, patients(id, full_name, birth_date, main_diagnosis, guardian_name, guardian_phone, sublime_entry_date, units(name, address, phone))")
        .eq("id", reportId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sections } = useQuery({
    queryKey: ["report-sections-print", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sections")
        .select("*, professionals(id, full_name, council_type, council_number, stamp_url, signature_url), specialties(id, name, color)")
        .eq("report_id", reportId)
        .order("order_index")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const patientId = report?.patients?.id;

  const { data: therapyGrid } = useQuery({
    queryKey: ["therapy-grid-patient", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("therapy_grid")
        .select("weekly_frequency, notes, specialties(name, color), professionals(full_name)")
        .eq("patient_id", patientId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientId,
  });

  // Toggles
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeMascot, setIncludeMascot] = useState(true);
  const [includePatientBlock, setIncludePatientBlock] = useState(true);
  const [includeDiagnosis, setIncludeDiagnosis] = useState(true);
  const [includeTherapyGrid, setIncludeTherapyGrid] = useState(true);
  const [includeGeneralNotes, setIncludeGeneralNotes] = useState(true);
  const [includeStamps, setIncludeStamps] = useState(true);
  const [includeFreqChart, setIncludeFreqChart] = useState(true);
  const [includeDistChart, setIncludeDistChart] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({});
  const [aiOverrides, setAiOverrides] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");

  const allSelected = useMemo(() => {
    const out: Record<string, boolean> = {};
    (sections ?? []).forEach((s: any) => {
      out[s.id] = selectedSections[s.id] ?? true;
    });
    return out;
  }, [sections, selectedSections]);

  const toggle = (id: string) =>
    setSelectedSections((p) => ({ ...p, [id]: !(p[id] ?? true) }));

  // Dedup por (specialty_id || title) — mantém a seção com mais dados preenchidos
  const visibleSections = useMemo(() => {
    const list = (sections ?? []).filter((s: any) => allSelected[s.id]);
    const score = (s: any) => {
      const fv = s.field_values ?? {};
      const filled = Object.values(fv).filter((v: any) => {
        if (v == null) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "object") return Object.values(v).some(Boolean);
        return String(v).trim().length > 0;
      }).length;
      const textLen = s.content && !isTemplateBoilerplate(s.content) ? String(s.content).trim().length : 0;
      return filled * 1000 + textLen;
    };
    const byKey = new Map<string, any>();
    for (const s of list) {
      const key = s.specialty_id ?? `t:${s.title ?? s.id}`;
      const prev = byKey.get(key);
      if (!prev || score(s) > score(prev)) byKey.set(key, s);
    }
    // preserva a ordem original
    const kept = new Set(Array.from(byKey.values()).map((s) => s.id));
    return list.filter((s: any) => kept.has(s.id));
  }, [sections, allSelected]);

  const printableSections = useMemo(
    () => visibleSections.filter((s: any) => isProfessionalReportSection(s)),
    [visibleSections],
  );

  const annexGroups = useMemo(
    () => buildAnnexGroups(printableSections),
    [printableSections],
  );

  const proseSections = useMemo(
    () => printableSections.filter((s: any) => {
      const fields: FormField[] = Array.isArray(s.fields) ? s.fields : [];
      const text = aiOverrides[s.id] ?? s.content;
      return fields.length === 0 && text && !isTemplateBoilerplate(text);
    }),
    [printableSections, aiOverrides],
  );

  const nextAnnexNumber = useMemo(() => {
    const printedNumbers = annexGroups.map((group: AnnexGroup) => group.number).filter((number: number) => number > 0);
    return Math.max(2, ...printedNumbers) + 1;
  }, [annexGroups]);

  // Group sections by specialty for the toolbar
  const sectionsBySpecialty = useMemo(() => {
    const groups: Record<string, { name: string; color?: string; items: any[] }> = {};
    (sections ?? []).forEach((s: any) => {
      const key = s.specialties?.id ?? "sem";
      if (!groups[key]) {
        groups[key] = {
          name: s.specialties?.name ?? "Sem área",
          color: s.specialties?.color,
          items: [],
        };
      }
      groups[key].items.push(s);
    });
    return groups;
  }, [sections]);

  const stampProfs = useMemo(() => {
    const map = new Map<string, any>();
    printableSections.forEach((s: any) => {
      const p = s.professionals;
      if (p && p.id && !map.has(p.id)) map.set(p.id, p);
    });
    return Array.from(map.values());
  }, [printableSections]);

  const chartData = useMemo(() => {
    return (therapyGrid ?? []).map((g: any) => ({
      name: g.specialties?.name ?? "—",
      sessoes: g.weekly_frequency ?? 0,
      color: g.specialties?.color ?? "#6366f1",
    }));
  }, [therapyGrid]);

  const hasCharts = (includeFreqChart || includeDistChart) && chartData.length > 0;

  // AI review per section
  const reviewFn = useServerFn(reviewSectionWithAI);
  const reviewMutation = useMutation({
    mutationFn: async (section: any) => {
      setReviewingId(section.id);
      const content = aiOverrides[section.id] ?? section.content ?? "";
      const res = await reviewFn({
        data: {
          content,
          sectionTitle: section.title,
          specialty: section.specialties?.name,
        },
      });
      return { id: section.id, reviewed: res.reviewed };
    },
    onSuccess: ({ id, reviewed }) => {
      setAiOverrides((p) => ({ ...p, [id]: reviewed }));
      toast.success("Texto revisado pela IA.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na revisão."),
    onSettled: () => setReviewingId(null),
  });

  const reviewAll = async () => {
    for (const s of visibleSections) {
      if (!s.content) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        await reviewMutation.mutateAsync(s);
      } catch { /* keep going */ }
    }
  };

  // Email
  const sendEmail = useServerFn(sendReportEmail);
  const emailMutation = useMutation({
    mutationFn: async () => {
      if (!emailTo.includes("@")) throw new Error("E-mail inválido.");
      await sendEmail({
        data: {
          to: emailTo,
          reportId,
          message: `Olá, segue o relatório de acompanhamento de ${report?.patients?.full_name ?? "seu filho(a)"}.`,
        },
      });
    },
    onSuccess: () => {
      toast.success("E-mail enviado.");
      setEmailOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar."),
  });

  // ===== Approval workflow =====
  const { user, isAdmin, isRespTecnicoOrAdmin, hasRole } = useAuth();
  const isDiretoria = hasRole("diretoria");
  const qc = useQueryClient();

  const { data: grid } = useQuery({
    queryKey: ["report-print-grid", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapy_grid")
        .select("specialty_id, professional_id, specialties(name, color), professionals(id, full_name, user_id)")
        .eq("patient_id", patientId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isSectionFilled = (s: any) => {
    if (!s) return false;
    const c = new Date(s.created_at).getTime();
    const u = new Date(s.updated_at).getTime();
    return u - c > 1500;
  };

  const pendencias = useMemo(() => {
    const items: { specialty_id: string; name: string; color?: string; professional?: any }[] = [];
    const filledSpecs = new Set(
      (sections ?? []).filter(isSectionFilled).map((s: any) => s.specialty_id).filter(Boolean),
    );
    const seen = new Set<string>();
    (grid ?? []).forEach((g: any) => {
      if (!g.specialty_id || seen.has(g.specialty_id)) return;
      seen.add(g.specialty_id);
      if (!filledSpecs.has(g.specialty_id)) {
        items.push({
          specialty_id: g.specialty_id,
          name: g.specialties?.name ?? "—",
          color: g.specialties?.color,
          professional: g.professionals,
        });
      }
    });
    return items;
  }, [sections, grid]);

  const filledList = useMemo(() => {
    return (sections ?? [])
      .filter((s: any) => s.specialty_id && isSectionFilled(s))
      .map((s: any) => ({
        specialty_id: s.specialty_id,
        section_id: s.id,
        name: s.specialties?.name ?? s.title,
        color: s.specialties?.color,
        professional: s.professionals,
      }));
  }, [sections]);

  const gridRequired = useMemo(
    () => new Set((grid ?? []).map((g: any) => g.specialty_id).filter(Boolean)).size,
    [grid],
  );
  const totalFilled = useMemo(
    () => new Set(filledList.map((f) => f.specialty_id)).size,
    [filledList],
  );
  // Se não há grade terapêutica cadastrada, considera as próprias seções do relatório
  const totalRequired = gridRequired > 0 ? gridRequired : (sections ?? []).filter((s: any) => s.specialty_id).length;
  const allComplete = totalFilled > 0 && (gridRequired === 0 || totalFilled >= gridRequired);

  // Pedir correção dialog
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<any>(null);
  const [correctionMsg, setCorrectionMsg] = useState("");

  const requestCorrection = useMutation({
    mutationFn: async () => {
      if (!correctionTarget) throw new Error("Seção inválida");
      if (!user?.id) throw new Error("Sessão expirada");
      const profId = correctionTarget.professional?.id ?? null;
      const ann: any = {
        author_id: user.id,
        kind: "correcao_relatorio",
        title: `Correção solicitada: ${correctionTarget.name}`,
        body: correctionMsg || `Por favor, revise a seção de ${correctionTarget.name} no relatório de ${report?.patients?.full_name ?? ""}.`,
        target_type: profId ? "professional" : "all",
        target_professional_id: profId,
        report_id: reportId,
        patient_id: report?.patients?.id ?? null,
      };
      const { error: aErr } = await supabase.from("announcements" as any).insert(ann);
      if (aErr) throw aErr;
      // garante que o relatório volte para edição
      if (report?.status !== "rascunho" && report?.status !== "em_revisao") {
        await supabase.from("reports").update({ status: "em_revisao" }).eq("id", reportId);
      }
    },
    onSuccess: () => {
      toast.success("Correção solicitada ao profissional.");
      setCorrectionOpen(false);
      setCorrectionMsg("");
      setCorrectionTarget(null);
      qc.invalidateQueries({ queryKey: ["report-print", reportId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao solicitar correção."),
  });

  const liberar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("reports")
        .update({
          status: "aprovado_diretoria",
          approved_by: user?.id ?? null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório liberado pela Diretoria.");
      qc.invalidateQueries({ queryKey: ["report-print", reportId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao liberar."),
  });

  const enviarImpressao = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("reports")
        .update({ status: "liberado_pais" })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório enviado para o módulo Impressões.");
      qc.invalidateQueries({ queryKey: ["report-print", reportId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar."),
  });


  if (!report) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

  return (
    <div>
      {/* Toolbar (oculta na impressão) */}
      <div className="print:hidden mb-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button asChild variant="ghost" size="sm">
            <Link to="/impressoes">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEmailOpen(true)} disabled={!allComplete} title={!allComplete ? "Todas as áreas precisam estar preenchidas" : undefined}>
              <Mail className="h-4 w-4 mr-1" /> Enviar por e-mail
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!allComplete} title={!allComplete ? "Todas as áreas precisam estar preenchidas" : undefined}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir pelo navegador
            </Button>
          </div>
        </div>

        {/* Painel de aprovação (apenas RT/Diretoria/PL) */}
        {(isRespTecnicoOrAdmin || isAdmin) && (
          <Card className="p-4 space-y-3 border-primary/30">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Fluxo de aprovação</h3>
                  <p className="text-xs text-muted-foreground">
                    Status atual: <strong>{statusLabel(report.status)}</strong>
                    {totalRequired > 0 && (
                      <> · {totalFilled}/{totalRequired} áreas preenchidas</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isDiretoria && report.status !== "aprovado_diretoria" && report.status !== "liberado_pais" && (
                  <Button
                    onClick={() => liberar.mutate()}
                    disabled={liberar.isPending || !allComplete}
                    title={!allComplete ? "Aguarde todas as áreas serem preenchidas" : "Liberar pela Diretoria"}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Liberar pela Diretoria
                  </Button>
                )}
                {report.status === "aprovado_diretoria" && (
                  <Button onClick={() => enviarImpressao.mutate()} disabled={enviarImpressao.isPending}>
                    <Send className="h-4 w-4 mr-1" /> Enviar para Impressão
                  </Button>
                )}
              </div>
            </div>

            {pendencias.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> Áreas pendentes ({pendencias.length})
                </div>
                <div className="space-y-1.5">
                  {pendencias.map((p) => (
                    <div key={p.specialty_id} className="flex items-center justify-between gap-2 text-sm bg-white rounded p-2 border border-amber-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color ?? "#f59e0b" }} />
                        <span className="font-medium truncate">{p.name}</span>
                        {p.professional?.full_name && (
                          <span className="text-xs text-muted-foreground truncate">· {p.professional.full_name}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCorrectionTarget(p);
                          setCorrectionMsg(`Por favor, preencha a seção de ${p.name} no relatório.`);
                          setCorrectionOpen(true);
                        }}
                      >
                        <MessageSquareWarning className="h-3.5 w-3.5 mr-1" /> Cobrar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Todas as áreas da grade terapêutica foram preenchidas.
              </div>
            )}

            {filledList.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Áreas preenchidas — pedir correção ao profissional:</div>
                <div className="flex flex-wrap gap-1.5">
                  {filledList.map((f) => (
                    <Button
                      key={f.section_id}
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs border"
                      onClick={() => {
                        setCorrectionTarget({
                          specialty_id: f.specialty_id,
                          name: f.name,
                          professional: f.professional,
                        });
                        setCorrectionMsg(`Por favor, revise a seção de ${f.name}.`);
                        setCorrectionOpen(true);
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full mr-1" style={{ background: f.color ?? "#10b981" }} />
                      {f.name}
                      {f.professional?.full_name && <span className="text-muted-foreground ml-1">· {f.professional.full_name}</span>}
                      <MessageSquareWarning className="h-3 w-3 ml-1.5 opacity-60" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        <Card className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Elementos do documento</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <Toggle label="Cabeçalho com logo" checked={includeHeader} onChange={setIncludeHeader} />
              <Toggle label="Mascote no rodapé" checked={includeMascot} onChange={setIncludeMascot} />
              <Toggle label="Dados do paciente" checked={includePatientBlock} onChange={setIncludePatientBlock} />
              <Toggle label="Diagnóstico principal" checked={includeDiagnosis} onChange={setIncludeDiagnosis} />
              <Toggle label="Grade terapêutica" checked={includeTherapyGrid} onChange={setIncludeTherapyGrid} />
              <Toggle label="Observações gerais" checked={includeGeneralNotes} onChange={setIncludeGeneralNotes} />
              <Toggle label="Carimbos e assinaturas" checked={includeStamps} onChange={setIncludeStamps} />
              <Toggle label="Gráfico de frequência (barras)" checked={includeFreqChart} onChange={setIncludeFreqChart} />
              <Toggle label="Distribuição por área (pizza)" checked={includeDistChart} onChange={setIncludeDistChart} />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">Seções por especialidade · profissional</h3>
            <div className="space-y-3">
              {Object.entries(sectionsBySpecialty).map(([key, group]) => (
                <div key={key} className="border rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {group.color && (
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: group.color }} />
                    )}
                    <span className="font-medium text-sm">{group.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {group.items.map((s: any) => (
                      <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
                        <label className="flex items-start gap-2 flex-1 min-w-0">
                          <Checkbox
                            checked={allSelected[s.id] ?? true}
                            onCheckedChange={() => toggle(s.id)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="font-medium">{s.title}</span>
                            {s.professionals?.full_name && (
                              <span className="text-muted-foreground"> · {s.professionals.full_name}</span>
                            )}
                            {aiOverrides[s.id] && (
                              <Badge variant="outline" className="ml-2 text-[10px] border-primary/40 text-primary">
                                <Sparkles className="h-3 w-3 mr-0.5" /> revisado
                              </Badge>
                            )}
                          </span>
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => reviewMutation.mutate(s)}
                          disabled={reviewingId === s.id || !s.content}
                          title="Revisar com IA"
                        >
                          {reviewingId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!sections?.length && <p className="text-sm text-muted-foreground">Sem seções neste relatório.</p>}
            </div>
          </div>
        </Card>
      </div>

      {/* Documento de impressão */}
      <div className="print-doc bg-white text-black mx-auto max-w-[800px] shadow print:shadow-none print:max-w-none">
        {/* Cabeçalho da marca */}
        {includeHeader && (
          <div
            data-pdf-header="true"
            className="px-10 pt-8 pb-6 text-white"
            style={{
              background:
                "linear-gradient(135deg, #312e81 0%, #4c1d95 55%, #2563eb 100%)",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <img src={logo} alt="Sublime" className="h-16 w-auto bg-white/95 rounded-md p-1.5" />
              <div className="text-center flex-1">
                <h1 className="text-2xl font-bold tracking-tight">Relatório Semestral Transdisciplinar</h1>
                <p className="text-[11px] uppercase tracking-[0.18em] opacity-90 mt-1">
                  Sublime · Acompanhamento Contínuo Transdisciplinar
                </p>
                {report.patients?.units?.name && (
                  <p className="text-[11px] opacity-80 mt-1">
                    {report.patients.units.name}
                    {report.patients.units.address && ` · ${report.patients.units.address}`}
                  </p>
                )}
              </div>
              {includeMascot && (
                <img src={subliminho} alt="" className="h-16 w-auto drop-shadow" />
              )}
            </div>
          </div>
        )}

        {/* ANEXO 1 — Identificação do Aprendiz */}
        {includePatientBlock && (
          <section className="px-10 py-6 border-b break-inside-avoid">
            <AnexoTitle number={1} title="Identificação do Aprendiz" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Paciente" value={report.patients?.full_name} />
              <Field label="Data de nascimento" value={fmtDate(report.patients?.birth_date)} />
              {includeDiagnosis && (
                <Field label="Diagnóstico principal (CID)" value={report.patients?.main_diagnosis} />
              )}
              <Field label="Responsável" value={report.patients?.guardian_name} />
              <Field label="Contato do responsável" value={report.patients?.guardian_phone} />
              <Field
                label="Período do relatório"
                value={`${fmtDate(report.period_start)} a ${fmtDate(report.period_end)}`}
              />
              <Field label="Entrada na Sublime" value={fmtDate(report.patients?.sublime_entry_date)} />
              <Field label="Emitido em" value={new Date().toLocaleDateString("pt-BR")} />
            </div>
          </section>
        )}

        {/* ANEXO 2 — Composição da Equipe Transdisciplinar */}
        {includeStamps && stampProfs.length > 0 && (
          <section className="px-10 py-6 border-b break-inside-avoid">
            <AnexoTitle number={2} title="Composição da Equipe Transdisciplinar" />
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-1.5 pr-3">Profissional</th>
                  <th className="py-1.5 pr-3">Conselho</th>
                  <th className="py-1.5 pr-3">Área</th>
                </tr>
              </thead>
              <tbody>
                {stampProfs.map((p: any) => {
                  const sec = printableSections.find((s: any) => s.professionals?.id === p.id);
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-medium">{p.full_name}</td>
                      <td className="py-1.5 pr-3">
                        {p.council_type && p.council_number
                          ? `${p.council_type}: ${p.council_number}`
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-3">{sec?.specialties?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}


        {/* Grade terapêutica */}
        {includeTherapyGrid && (therapyGrid?.length ?? 0) > 0 && (
          <div className="px-10 py-6 border-b break-inside-avoid">
            <h3 className="text-lg font-bold text-primary border-b pb-1 mb-3">Grade Terapêutica</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-1.5 pr-3">Especialidade</th>
                  <th className="py-1.5 pr-3">Profissional</th>
                  <th className="py-1.5 pr-3 text-center">Freq. semanal</th>
                </tr>
              </thead>
              <tbody>
                {therapyGrid?.map((g: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">
                      <span className="inline-flex items-center gap-2">
                        {g.specialties?.color && (
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: g.specialties.color }} />
                        )}
                        {g.specialties?.name ?? "—"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">{g.professionals?.full_name ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-center font-medium">{g.weekly_frequency}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Título + observações gerais */}
        <div className="px-10 py-6">
          <h2 className="text-2xl font-bold mb-2">{report.title}</h2>
          {includeGeneralNotes && report.general_notes && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {report.general_notes}
            </p>
          )}
        </div>

        {/* Seções das áreas agrupadas por anexo */}
        <div className="px-10 pb-8 space-y-6">
          {annexGroups.map((group: AnnexGroup) => (
            <section key={group.key} className="break-inside-avoid">
              <AnexoTitle number={group.number} title={group.title} />
              <div className="space-y-5">
                {group.sections.map((s: any) => (
                  <ProfessionalAnnexBlock key={`${group.key}-${s.id}`} section={s} group={group} />
                ))}
              </div>
            </section>
          ))}
          {proseSections.map((s: any, idx: number) => (
            <section key={s.id} className="break-inside-avoid">
              <AnexoTitle number={nextAnnexNumber + idx} title={cleanSectionTitle(s.title, s.specialties?.name)} accent={s.specialties?.color} />
              <ProfessionalMeta section={s} />
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{aiOverrides[s.id] ?? s.content}</p>
            </section>
          ))}
          {!annexGroups.length && !proseSections.length && (
            <p className="text-sm text-muted-foreground italic">Nenhuma seção selecionada.</p>
          )}
        </div>


        {/* Gráficos */}
        {hasCharts && (
          <div className="px-10 pb-8 break-inside-avoid">
            <h3 className="text-lg font-bold text-primary border-b pb-1 mb-4">Indicadores</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {includeFreqChart && (
                <div>
                  <p className="text-sm font-medium mb-2 text-center">Frequência semanal por área</p>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" fontSize={10} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} fontSize={10} />
                        <Tooltip />
                        <Bar dataKey="sessoes">
                          {chartData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {includeDistChart && (
                <div>
                  <p className="text-sm font-medium mb-2 text-center">Distribuição por área</p>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={chartData} dataKey="sessoes" nameKey="name" outerRadius={80} label={{ fontSize: 10 } as any}>
                          {chartData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Anexo final — Assinaturas */}
        {includeStamps && stampProfs.length > 0 && (
          <div className="px-10 py-8 page-break-before border-t">
            <AnexoTitle number={nextAnnexNumber + proseSections.length} title="Assinaturas" />
            <p className="text-sm text-muted-foreground mb-6">
              Rio de Janeiro, {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.
            </p>

            <div className="grid grid-cols-2 gap-x-10 gap-y-10">
              {stampProfs.map((p: any) => (
                <div key={p.id} className="break-inside-avoid text-center">
                  <div className="h-32 flex items-end justify-center border-b border-foreground/40 mb-2 px-2">
                    {p.signature_url && (
                      <img src={p.signature_url} alt="Assinatura" className="max-h-20 object-contain mb-1" />
                    )}
                    {p.stamp_url && (
                      <img src={p.stamp_url} alt="Carimbo" className="max-h-24 object-contain ml-2" />
                    )}
                  </div>
                  <p className="text-sm font-semibold">{p.full_name}</p>
                  {p.council_type && p.council_number && (
                    <p className="text-xs text-muted-foreground">
                      {p.council_type}: {p.council_number}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="px-10 py-6 flex items-center justify-between border-t mt-4">
          {includeMascot ? (
            <img src={subliminho} alt="" className="h-12 opacity-80" />
          ) : <span />}
          <p className="text-xs text-muted-foreground text-right">
            Sublime · Acompanhamento Contínuo Transdisciplinar<br />
            Documento gerado em {new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      {/* E-mail */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar relatório por e-mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>E-mail do destinatário (pais / responsável)</Label>
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="responsavel@email.com"
              />
            </div>
            {report.status !== "aprovado_diretoria" && report.status !== "liberado_pais" && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Atenção: este relatório ainda não foi aprovado pela Diretoria Clínica.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancelar</Button>
            <Button onClick={() => emailMutation.mutate()} disabled={emailMutation.isPending}>
              {emailMutation.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pedir correção */}
      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedir correção ao profissional</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {correctionTarget && (
              <div className="text-sm bg-muted/40 rounded p-2 border">
                <div><strong>Área:</strong> {correctionTarget.name}</div>
                {correctionTarget.professional?.full_name && (
                  <div><strong>Profissional:</strong> {correctionTarget.professional.full_name}</div>
                )}
              </div>
            )}
            <div>
              <Label>Mensagem</Label>
              <Textarea
                rows={4}
                value={correctionMsg}
                onChange={(e) => setCorrectionMsg(e.target.value)}
                placeholder="Descreva o ajuste necessário…"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O profissional receberá um recado no painel dele com link para o relatório. O status do relatório voltará para "Em revisão".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>Cancelar</Button>
            <Button onClick={() => requestCorrection.mutate()} disabled={requestCorrection.isPending}>
              {requestCorrection.isPending ? "Enviando…" : "Enviar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white !important; }
          .print-doc { box-shadow: none !important; max-width: none !important; }
          .page-break-before { page-break-before: always; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
          aside, nav, header[data-sidebar], [data-sidebar] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>{label}</span>
    </label>
  );
}

function AnexoTitle({ number, title, accent }: { number: number; title: string; accent?: string }) {
  return (
    <div className="flex items-stretch mb-3 break-inside-avoid">
      <div
        data-pdf-accent="true"
        className="flex items-center justify-center text-white font-bold text-sm px-3 rounded-l"
        style={{
          background: "linear-gradient(135deg, #312e81, #4c1d95)",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
          minWidth: 96,
        }}
      >
        ANEXO {number}
      </div>
      <div
        data-pdf-accent="true"
        className="flex items-center flex-1 px-3 py-1.5 rounded-r border border-l-0"
        style={{
          background: "#eef2ff",
          borderColor: accent ?? "#c7d2fe",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        {accent && (
          <span
            className="inline-block h-3 w-3 rounded-full mr-2"
            style={{ background: accent, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
          />
        )}
        <span className="font-semibold text-[15px]" style={{ color: "#312e81" }}>{title}</span>
      </div>
    </div>
  );
}

type AnnexSection = { id: string; section: any; fields: FormField[] };
type AnnexGroup = { key: string; number: number; title: string; sections: AnnexSection[] };

const ANNEX_TITLES: Record<number, string> = {
  3: "Registro de Objetivos por Área de Intervenção",
  4: "Síntese da Evolução no Semestre",
  5: "Aspectos Observados no Período",
  6: "Orientações e Comunicação com a Família",
  7: "Focos e Recomendações para o Próximo Semestre",
  8: "Observações Gerais / Possíveis Encaminhamentos",
};

function isProfessionalReportSection(section: any) {
  if (!section?.specialty_id && !section?.professional_id) return false;
  const fields: FormField[] = Array.isArray(section.fields) ? section.fields : [];
  const values = section.field_values ?? {};
  const hasFields = fields.some((field) => hasPrintableFieldValue(field, values[field.id]));
  const text = section.content && !isTemplateBoilerplate(section.content) ? String(section.content).trim() : "";
  return hasFields || text.length > 0;
}

function buildAnnexGroups(sections: any[]): AnnexGroup[] {
  const groups = new Map<number, { group: AnnexGroup; sectionMap: Map<string, AnnexSection> }>();
  sections.forEach((section: any) => {
    const fields: FormField[] = Array.isArray(section.fields) ? section.fields : [];
    const values = section.field_values ?? {};
    fields.forEach((field) => {
      if (!hasPrintableFieldValue(field, values[field.id])) return;
      const number = getAnnexNumber(field.label);
      if (!number) return;
      if (!groups.has(number)) {
        groups.set(number, {
          group: { key: `annex-${number}`, number, title: ANNEX_TITLES[number] ?? cleanFieldLabel(field.label), sections: [] },
          sectionMap: new Map(),
        });
      }
      const bucket = groups.get(number)!;
      if (!bucket.sectionMap.has(section.id)) {
        const entry = { id: section.id, section, fields: [] };
        bucket.sectionMap.set(section.id, entry);
        bucket.group.sections.push(entry);
      }
      bucket.sectionMap.get(section.id)!.fields.push(field);
    });
  });
  return Array.from(groups.values()).map(({ group }) => group).sort((a, b) => a.number - b.number);
}

function ProfessionalAnnexBlock({ section: entry, group }: { section: AnnexSection; group: AnnexGroup }) {
  const section = entry.section;
  return (
    <div className="break-inside-avoid border-b pb-4 last:border-b-0 last:pb-0">
      <h4 className="text-sm font-bold mb-1">{cleanSectionTitle(section.title, section.specialties?.name)}</h4>
      <ProfessionalMeta section={section} />
      <PrintableFields fields={entry.fields} values={section.field_values ?? {}} groupTitle={group.title} />
    </div>
  );
}

function ProfessionalMeta({ section }: { section: any }) {
  return (
    <div className="text-xs text-muted-foreground mb-2 flex flex-wrap gap-x-3">
      {section.specialties?.name && <span>Área: {section.specialties.name}</span>}
      {section.professionals?.full_name && <span>Profissional: {section.professionals.full_name}</span>}
      {section.professionals?.council_type && section.professionals?.council_number && (
        <span>{section.professionals.council_type}: {section.professionals.council_number}</span>
      )}
    </div>
  );
}

function PrintableFields({ fields, values, groupTitle }: { fields: FormField[]; values: Record<string, any>; groupTitle: string }) {
  const levelLabel = (level: string) => OBJECTIVE_LEVELS.find((item) => item.value === level)?.label ?? "—";
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const value = values?.[field.id];
        const label = cleanFieldLabel(field.label);
        const showLabel = shouldShowFieldLabel(label, groupTitle);
        if (field.type === "objective_levels") {
          const rows = (Array.isArray(value?.rows) ? value.rows : []).filter((row: any) => row?.text || row?.level);
          if (!rows.length) return null;
          return (
            <div key={field.id} className="break-inside-avoid">
              {showLabel && <p className="text-sm font-semibold mb-1">{label}</p>}
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-muted-foreground border-b">
                    <th className="py-1 pr-2">Objetivo Terapêutico</th>
                    <th className="py-1 px-1 w-[30%]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, index: number) => (
                    <tr key={index} className="border-b last:border-0 align-top">
                      <td className="py-1 pr-2 whitespace-pre-wrap">{row.text || "—"}</td>
                      <td className="py-1 px-1">{levelLabel(row.level)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (field.type === "family_guidelines") {
          const rows = (Array.isArray(value?.rows) ? value.rows : []).filter((row: any) => row?.guideline || row?.responsible);
          if (!rows.length) return null;
          return (
            <div key={field.id} className="break-inside-avoid">
              {showLabel && <p className="text-sm font-semibold mb-1">{label}</p>}
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-muted-foreground border-b">
                    <th className="py-1 pr-2">Estratégia / Orientação</th>
                    <th className="py-1 px-1 w-[40%]">Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, index: number) => (
                    <tr key={index} className="border-b last:border-0 align-top">
                      <td className="py-1 pr-2 whitespace-pre-wrap">{row.guideline || "—"}</td>
                      <td className="py-1 px-1">{row.responsible || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (!hasPrintableFieldValue(field, value)) return null;
        const display = Array.isArray(value)
          ? value.join(", ")
          : field.type === "yes_no"
            ? value === "sim" ? "Sim" : value === "nao" ? "Não" : String(value)
            : String(value);
        return (
          <div key={field.id} className="break-inside-avoid">
            <span className="text-sm font-semibold">{label}: </span>
            <span className="text-sm whitespace-pre-wrap">{display}</span>
          </div>
        );
      })}
    </div>
  );
}

function hasPrintableFieldValue(field: FormField, value: any) {
  if (field.type === "objective_levels") {
    return Array.isArray(value?.rows) && value.rows.some((row: any) => row?.text || row?.level);
  }
  if (field.type === "family_guidelines") {
    return Array.isArray(value?.rows) && value.rows.some((row: any) => row?.guideline || row?.responsible);
  }
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function getAnnexNumber(label: string | null | undefined) {
  const match = String(label ?? "").match(/anexo\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function cleanSectionTitle(title: string | null | undefined, specialtyName?: string) {
  const cleaned = cleanFieldLabel(title);
  if (!cleaned || cleaned.toLowerCase() === "área do profissional") return specialtyName ?? "Área do profissional";
  return cleaned.replace(/^Área:\s*/i, "") || specialtyName || cleaned;
}

function cleanFieldLabel(label: string | null | undefined) {
  return String(label ?? "")
    .replace(/^\s*anexo\s*\d+\s*[—–-]\s*/i, "")
    .replace(/\s*\([^)]{18,}\)/g, "")
    .split(/\.\s+/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function shouldShowFieldLabel(label: string, groupTitle: string) {
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const a = normalize(label);
  const b = normalize(groupTitle);
  return !!a && a !== b && !b.includes(a) && !a.includes(b);
}

/** Detecta textos institucionais/instrucionais que vieram do modelo do relatório. */
function isTemplateBoilerplate(text: string | null | undefined): boolean {
  if (!text) return true;
  const t = String(text).toLowerCase().trim();
  if (!t) return true;
  const patterns = [
    "preencha os anexos",
    "revisar com a ia",
    "revisar com ia",
    "para cada objetivo trabalhado",
    "sinalize:",
    "registro por objetivo",
    "referente a sua área de atuação",
    "referente à sua área de atuação",
    "cada bloco",
    "liste cada estratégia",
    "adicionar orientação",
    "adicionar objetivo",
  ];
  return patterns.some((p) => t.includes(p));
}


function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function statusLabel(s: string) {
  return ({
    rascunho: "Rascunho",
    em_revisao: "Em revisão",
    aprovado_diretoria: "Aprovado pela Diretoria Clínica",
    liberado_pais: "Liberado aos pais",
  } as Record<string, string>)[s] ?? s;
}
