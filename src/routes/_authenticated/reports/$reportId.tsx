import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-shell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Plus, Trash2, History, Save, Download, AlertCircle, CheckCircle2 } from "lucide-react";

import { REPORT_TITLE_OPTIONS } from "@/routes/_authenticated/reports";
import { SectionSigners } from "@/components/signatures";
import { FieldsRenderer, type FormField } from "@/components/form-fields";
import { PatientEvolutionChart } from "@/components/patient-evolution-chart";
import { selectProfessionalSection } from "@/lib/report-section-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/reports/$reportId")({
  head: () => ({ meta: [{ title: "Relatório — ACT Sublime" }] }),
  component: ReportRouteShell,
});

function ReportRouteShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.endsWith("/print")) return <Outlet />;
  return <ReportDetailPage />;
}

const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "em_revisao", label: "Enviado para revisão" },
  { value: "aprovado_diretoria", label: "Aprovado pela diretoria" },
  { value: "liberado_pais", label: "Liberado aos pais" },
];

function ReportDetailPage() {
  const { reportId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, isRespTecnicoOrAdmin, loading: authLoading } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const handledFillIntent = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#historico") {
      setHistoryOpen(true);
    }
  }, []);

  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newSection, setNewSection] = useState({
    professional_id: "",
    specialty_id: "",
    title: "",
    content: "",
  });

  const { data: report, error: reportError, isLoading: reportLoading } = useQuery({
    queryKey: ["report", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .single();
      if (error) throw error;

      const patient = data?.patient_id
        ? await supabase
            .from("patients")
            .select("id, full_name, birth_date, main_diagnosis, unit_id")
            .eq("id", data.patient_id)
            .maybeSingle()
        : { data: null, error: null };
      if (patient.error) throw patient.error;

      const unit = patient.data?.unit_id
        ? await supabase
            .from("units")
            .select("id, name")
            .eq("id", patient.data.unit_id)
            .maybeSingle()
        : { data: null, error: null };
      if (unit.error) throw unit.error;

      return {
        ...data,
        patients: patient.data
          ? {
              ...patient.data,
              units: unit.data,
            }
          : null,
      };
    },
    enabled: !!user?.id,
  });

  const { data: sections, error: sectionsError } = useQuery({
    queryKey: ["report-sections", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sections")
        .select("*")
        .eq("report_id", reportId)
        .order("order_index")
        .order("created_at");
      if (error) throw error;

      const specialtyIds = [...new Set((data ?? []).map((section: any) => section.specialty_id).filter(Boolean))];
      const professionalIds = [...new Set((data ?? []).map((section: any) => section.professional_id).filter(Boolean))];

      const [{ data: specialtyRows, error: specialtiesError }, { data: professionalRows, error: professionalsError }] = await Promise.all([
        specialtyIds.length
          ? supabase.from("specialties").select("id, name, color").in("id", specialtyIds)
          : Promise.resolve({ data: [], error: null }),
        professionalIds.length
          ? supabase.from("professionals").select("id, full_name").in("id", professionalIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (specialtiesError) throw specialtiesError;
      if (professionalsError) throw professionalsError;

      // Para seções sem campos cadastrados, tenta hidratar a partir do módulo do template
      // correspondente à especialidade — assim seções criadas manualmente também exibem
      // todos os campos esperados para preenchimento.
      const needsHydration = (data ?? []).filter(
        (s: any) => s.specialty_id && (!Array.isArray(s.fields) || s.fields.length === 0),
      );
      let modulesBySpecialty = new Map<string, any>();
      if (needsHydration.length > 0) {
        const { data: report0 } = await supabase
          .from("reports").select("template_id").eq("id", reportId).maybeSingle();
        const tplId = (report0 as any)?.template_id;
        if (tplId) {
          const { data: mods } = await supabase
            .from("report_template_modules")
            .select("specialty_id, title, description, fields")
            .eq("template_id", tplId)
            .in("specialty_id", needsHydration.map((s: any) => s.specialty_id));
          modulesBySpecialty = new Map((mods ?? []).map((m: any) => [m.specialty_id, m]));
        }
      }

      const specialtiesById = new Map((specialtyRows ?? []).map((specialty: any) => [specialty.id, specialty]));
      const professionalsById = new Map((professionalRows ?? []).map((professional: any) => [professional.id, professional]));

      return (data ?? []).map((section: any) => {
        let hydratedFields = Array.isArray(section.fields) ? section.fields : [];
        if (section.specialty_id && hydratedFields.length === 0) {
          const mod = modulesBySpecialty.get(section.specialty_id);
          if (mod && Array.isArray(mod.fields) && mod.fields.length > 0) {
            hydratedFields = mod.fields;
          }
        }
        return {
          ...section,
          fields: hydratedFields,
          specialties: section.specialty_id ? specialtiesById.get(section.specialty_id) ?? null : null,
          professionals: section.professional_id ? professionalsById.get(section.professional_id) ?? null : null,
        };
      });
    },
    enabled: !!user?.id,
    placeholderData: (prev) => prev,
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals-min"],
    queryFn: async () =>
      (await supabase.from("professionals").select("id, full_name, specialty_id").order("full_name")).data ?? [],
    enabled: !!user?.id,
  });

  const { data: specialties } = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => (await supabase.from("specialties").select("*").order("name")).data ?? [],
    enabled: !!user?.id,
  });

  const { data: patientGrid } = useQuery({
    queryKey: ["patient-grid", report?.patient_id],
    enabled: !!report?.patient_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapy_grid")
        .select("specialty_id, specialties(name)")
        .eq("patient_id", report!.patient_id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Profissional vinculado ao usuário atual (para liberar edição só da sua área)
  const { data: myProfessional, isLoading: myProfessionalLoading } = useQuery({
    queryKey: ["my-professional-detail", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("professionals")
        .select("id, specialty_id, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;

      const specialty = data?.specialty_id
        ? await supabase
            .from("specialties")
            .select("id, name, color")
            .eq("id", data.specialty_id)
            .maybeSingle()
        : { data: null, error: null };
      if (specialty.error) throw specialty.error;

      return data ? { ...data, specialties: specialty.data } : null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const reportLocked =
    report?.status === "aprovado_diretoria" || report?.status === "liberado_pais";

  const mySection = useMemo(
    () => selectProfessionalSection(sections, myProfessional),
    [sections, myProfessional],
  );

  const canEditSection = (s: any) => {
    if (isRespTecnicoOrAdmin || isAdmin) return true;
    if (reportLocked) return false;
    if (!myProfessional) return false;
    // Seções gerais (sem especialidade) são comuns a todos os profissionais
    if (!s.specialty_id && !s.professional_id) return true;
    return (
      (!!myProfessional.id && s.professional_id === myProfessional.id) ||
      (!!myProfessional.specialty_id && s.specialty_id === myProfessional.specialty_id)
    );
  };

  useEffect(() => {
    if (handledFillIntent.current || typeof window === "undefined") return;
    if (window.location.hash !== "#preencher") return;
    if (!user || !report || !sections || !specialties) return;
    if (isRespTecnicoOrAdmin || isAdmin) return;

    if (mySection) {
      handledFillIntent.current = true;
      requestAnimationFrame(() => {
        document.getElementById(`section-${mySection.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }

    // Profissional sem seção: pré-preenche e abre o modal de confirmação.
    if (myProfessional && !reportLocked) {
      handledFillIntent.current = true;
      const specName =
        specialties.find((s: any) => s.id === myProfessional.specialty_id)?.name ?? "Minha área";
      setNewSection({
        professional_id: myProfessional.id,
        specialty_id: myProfessional.specialty_id ?? "",
        title: specName,
        content: "",
      });
      setNewSectionOpen(true);
    }
  }, [myProfessional, mySection, report, reportLocked, sections, specialties, user, isRespTecnicoOrAdmin, isAdmin]);



  const { data: auditLog } = useQuery({
    queryKey: ["report-audit", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_audit_log")
        .select("*")
        .eq("report_id", reportId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: historyOpen,
  });

  const updateReport = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("reports").update(patch).eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report", reportId] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Relatório atualizado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addSection = useMutation({
    mutationFn: async () => {
      if (!isRespTecnicoOrAdmin && mySection) return;
      if (!isRespTecnicoOrAdmin && !myProfessional?.id) {
        throw new Error("Cadastro profissional não encontrado para este usuário.");
      }
      const mySpecialtyName = myProfessional?.specialties?.name ?? "Minha área";
      const finalSection = !isRespTecnicoOrAdmin && myProfessional
        ? {
            professional_id: myProfessional.id,
            specialty_id: myProfessional.specialty_id ?? "",
            title: newSection.title || `Área: ${mySpecialtyName}`,
            content: newSection.content,
          }
        : newSection;

      if (!finalSection.title) throw new Error("Título é obrigatório.");
      // Blindagem: se já existe seção do template para esta especialidade neste relatório,
      // reaproveita (vincula ao profissional) em vez de criar duplicata vazia.
      if (finalSection.specialty_id) {
        const existing = (sections ?? []).find(
          (s: any) => s.specialty_id === finalSection.specialty_id,
        );
        if (existing) {
          const patch: any = { updated_by: user?.id };
          if (finalSection.professional_id && !existing.professional_id) {
            patch.professional_id = finalSection.professional_id;
          }
          // Se a seção existente está sem campos mas o template tem, hidrata os campos.
          const existingFields = Array.isArray(existing.fields) ? existing.fields : [];
          if (existingFields.length === 0 && report?.template_id) {
            const { data: mod } = await supabase
              .from("report_template_modules")
              .select("title, description, fields")
              .eq("template_id", report.template_id)
              .eq("specialty_id", finalSection.specialty_id)
              .maybeSingle();
            const tplFields = Array.isArray((mod as any)?.fields) ? (mod as any).fields : [];
            if (tplFields.length > 0) {
              patch.fields = tplFields;
              if (!existing.content && (mod as any)?.description) {
                patch.content = (mod as any).description;
              }
              if ((!existing.title || existing.title === mySpecialtyName) && (mod as any)?.title) {
                patch.title = (mod as any).title;
              }
            }
          }
          const { error } = await supabase
            .from("report_sections")
            .update(patch)
            .eq("id", existing.id);
          if (error) throw error;
          return;
        }
      }

      // Carrega campos do módulo do template para essa especialidade (se houver),
      // para que a seção criada manualmente já apareça com todos os campos para preencher.
      let templateFields: any[] = [];
      let templateContent: string | null = null;
      let templateTitle: string | null = null;
      let templateOrder: number | null = null;
      if (report?.template_id && finalSection.specialty_id) {
        const { data: mod } = await supabase
          .from("report_template_modules")
          .select("title, description, fields, order_index")
          .eq("template_id", report.template_id)
          .eq("specialty_id", finalSection.specialty_id)
          .maybeSingle();
        if (mod) {
          templateFields = Array.isArray((mod as any).fields) ? (mod as any).fields : [];
          templateContent = (mod as any).description ?? null;
          templateTitle = (mod as any).title ?? null;
          templateOrder = (mod as any).order_index ?? null;
        }
      }

      const payload: any = {
        ...finalSection,
        title: finalSection.title || templateTitle || `Área: ${mySpecialtyName}`,
        content: finalSection.content || templateContent,
        fields: templateFields,
        field_values: {},
        report_id: reportId,
        created_by: user?.id,
        updated_by: user?.id,
      };
      if (templateOrder != null) payload.order_index = templateOrder;
      if (!payload.professional_id) delete payload.professional_id;
      if (!payload.specialty_id) delete payload.specialty_id;
      const { error } = await supabase.from("report_sections").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-sections", reportId] });
      setNewSection({ professional_id: "", specialty_id: "", title: "", content: "" });
      setNewSectionOpen(false);
      toast.success("Seção pronta para preenchimento.");
    },
    onError: (e: any) => {
      toast.error(e.message);
    },
  });

  const saveSection = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase
        .from("report_sections")
        .update({ ...patch, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      // Auto-promote status: if a professional saves and the report is still a draft,
      // flip it to "em_revisao" so it shows as "Enviado para revisão".
      if (report?.status === "rascunho" && !reportLocked) {
        await supabase.from("reports").update({ status: "em_revisao" as any }).eq("id", reportId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-sections", reportId] });
      qc.invalidateQueries({ queryKey: ["report", reportId] });
      toast.success("Seção salva.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-sections", reportId] });
      toast.success("Seção removida.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (authLoading || reportLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  if (reportError || sectionsError) {
    return (
      <div className="p-8 text-destructive">
        Não foi possível abrir o relatório: {((reportError ?? sectionsError) as Error).message}
      </div>
    );
  }

  if (!report) return <div className="p-8 text-muted-foreground">Relatório não encontrado.</div>;

  const isStaff = isRespTecnicoOrAdmin || isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/reports"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
      </div>


      <PageHeader
        title={report.title}
        description={`Paciente: ${report.patients?.full_name ?? "—"}${report.patients?.units?.name ? " · " + report.patients.units.name : ""}`}
        action={
          <div className="flex gap-2">
            {isStaff && <RequestCorrectionButton reportId={reportId} />}
            {isStaff && (
              <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                <History className="h-4 w-4 mr-1" /> Histórico
              </Button>
            )}
            {isRespTecnicoOrAdmin && (
              <Button asChild variant="outline">
                <a href={`/reports/${reportId}/print?auto=1`} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-1" /> Baixar PDF
                </a>
              </Button>
            )}
          </div>
        }
      />

      {isStaff && (
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Tipo de relatório</Label>
            <Select value={REPORT_TITLE_OPTIONS.includes(report.title) ? report.title : ""} onValueChange={(v) => updateReport.mutate({ title: v })}>
              <SelectTrigger><SelectValue placeholder={report.title || "Selecione"} /></SelectTrigger>
              <SelectContent>
                {REPORT_TITLE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Início</Label>
            <Input
              type="date"
              defaultValue={report.period_start ?? ""}
              onBlur={(e) => e.target.value !== (report.period_start ?? "") && updateReport.mutate({ period_start: e.target.value || null })}
            />
          </div>
          <div>
            <Label>Fim</Label>
            <Input
              type="date"
              defaultValue={report.period_end ?? ""}
              onBlur={(e) => e.target.value !== (report.period_end ?? "") && updateReport.mutate({ period_end: e.target.value || null })}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={report.status} onValueChange={(v) => updateReport.mutate({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value} disabled={s.value === "aprovado_diretoria" && !isAdmin}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Observações gerais</Label>
          <Textarea
            defaultValue={report.general_notes ?? ""}
            rows={3}
            onBlur={(e) => e.target.value !== (report.general_notes ?? "") && updateReport.mutate({ general_notes: e.target.value })}
          />
        </div>
      </Card>
      )}

      {isStaff && report.patient_id && <PatientEvolutionChart patientId={report.patient_id} />}

      {(() => {
        // Espera profissional + seções carregarem antes de decidir mostrar o botão
        if (!isStaff && (myProfessionalLoading || !sections)) return null;
        const alreadyHasMine = !!mySection;
        const canAddAny = isRespTecnicoOrAdmin;
        const canAddOwn = !!myProfessional && !reportLocked && !alreadyHasMine;
        const showButton = canAddAny || canAddOwn;
        if (!isStaff && !showButton) return null;
        return (
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{isStaff ? "Seções por profissional" : "Minha seção"}</h2>
        {showButton && (
        <Dialog
          open={newSectionOpen}
          onOpenChange={(o) => {
            setNewSectionOpen(o);
            if (o && !canAddAny && myProfessional) {
              const specName = myProfessional.specialties?.name ?? "Minha área";
              setNewSection({
                professional_id: myProfessional.id,
                specialty_id: myProfessional.specialty_id ?? "",
                title: `Área: ${specName}`,
                content: "",
              });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> {canAddAny ? "Nova seção" : "Preencher minha seção"}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{canAddAny ? "Nova seção" : "Preencher minha seção"}</DialogTitle>
              <DialogDescription>
                {canAddAny ? "Adicione uma seção ao relatório." : "Confirme seu vínculo profissional antes de abrir o formulário."}
              </DialogDescription>
            </DialogHeader>
            {!canAddAny ? (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Confirme os dados abaixo. Sua seção será criada com seu nome e sua área, e em seguida o formulário ficará disponível para preenchimento.
                </p>
                <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Profissional</span>
                    <span className="font-medium text-right">
                      {myProfessional?.full_name ?? professionals?.find((p: any) => p.id === newSection.professional_id)?.full_name ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Área</span>
                    <span className="font-medium text-right">
                      {myProfessional?.specialties?.name ?? specialties?.find((s: any) => s.id === newSection.specialty_id)?.name ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Título da seção</span>
                    <span className="font-medium text-right">{newSection.title || "—"}</span>
                  </div>
                </div>
              </div>
            ) : (
            <div className="space-y-3">
              <div>
                <Label>Profissional</Label>
                <Select
                  value={newSection.professional_id}
                  onValueChange={(v) => {
                    const prof = professionals?.find((p: any) => p.id === v);
                    setNewSection({
                      ...newSection,
                      professional_id: v,
                      specialty_id: prof?.specialty_id || newSection.specialty_id,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {professionals?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Especialidade / Área</Label>
                <Select
                  value={newSection.specialty_id}
                  onValueChange={(v) => setNewSection({ ...newSection, specialty_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {specialties?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título da seção *</Label>
                <Input
                  value={newSection.title}
                  onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
                  placeholder="Ex.: Avaliação Fonoaudiológica"
                />
              </div>
              <div>
                <Label>Conteúdo inicial (opcional)</Label>
                <Textarea
                  rows={4}
                  value={newSection.content}
                  onChange={(e) => setNewSection({ ...newSection, content: e.target.value })}
                />
              </div>
            </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewSectionOpen(false)}>Cancelar</Button>
              <Button onClick={() => addSection.mutate()} disabled={addSection.isPending}>
                {canAddAny ? "Adicionar" : "Continuar e preencher"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>
        );
      })()}

      {(() => {
        const all = sections ?? [];
        // Espera profissional + seções carregarem para evitar flash de "Sua seção não foi criada"
        const waiting = !sections || (!isStaff && (myProfessionalLoading || !myProfessional));

        // Não-staff vê: seções gerais (sem especialidade nem profissional) + sua própria seção
        const commonSections = all.filter((s: any) => !s.specialty_id && !s.professional_id);
        const visible = isStaff
          ? all
          : [...commonSections, ...(mySection ? [mySection] : [])];

        if (waiting) {
          return (
            <Card className="p-6 text-center text-sm text-muted-foreground">Carregando sua seção…</Card>
          );
        }

        return (
          <>
            {isStaff && !all.length && (
              <Card className="p-8 text-center text-muted-foreground">
                Nenhuma seção ainda. Adicione a primeira para começar.
              </Card>
            )}
            {!isStaff && !visible.length && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Sua seção ainda não foi criada. Clique em "Preencher minha seção" acima.
              </Card>
            )}
            <div className="space-y-4">
              {visible.map((s: any) => (
                <SectionCard
                  key={s.id}
                  section={s}
                  canEdit={canEditSection(s)}
                  onSave={(patch) => saveSection.mutate({ id: s.id, patch })}
                  onDelete={() => deleteSection.mutate(s.id)}
                />
              ))}
            </div>
          </>
        );
      })()}

      {(() => {
        if (reportLocked) return null;
        const canConclude = isStaff || (!!mySection && !reportLocked);
        if (!canConclude) return null;
        const isDraft = report.status === "rascunho";
        if (!isDraft) return null;

        const sectionEdited = (sec: any) => {
          if (!sec) return false;
          const c = new Date(sec.created_at).getTime();
          const u = new Date(sec.updated_at).getTime();
          return u - c > 1500;
        };

        let allFilled = false;
        let missingLabel = "";
        if (isStaff) {
          const filledSpecs = new Set<string>(
            (sections ?? []).filter((s: any) => s.specialty_id && sectionEdited(s)).map((s: any) => s.specialty_id),
          );
          const requiredSpecs = (patientGrid ?? [])
            .filter((g: any) => g.specialty_id)
            .reduce((acc: Map<string, string>, g: any) => {
              if (!acc.has(g.specialty_id)) acc.set(g.specialty_id, g.specialties?.name ?? "—");
              return acc;
            }, new Map<string, string>());
          const missing = Array.from(requiredSpecs.entries()).filter(([id]) => !filledSpecs.has(id));
          allFilled = requiredSpecs.size > 0 && missing.length === 0;
          missingLabel = missing.map(([, n]) => n).join(", ");
        } else {
          // Profissional: só precisa ter preenchido a própria seção.
          allFilled = sectionEdited(mySection);
          if (!allFilled) missingLabel = "sua seção";
        }

        return (
          <div className="flex flex-col items-end gap-2 pt-2">
            {!allFilled && missingLabel && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 max-w-md">
                {isStaff ? `Faltam preencher: ${missingLabel}` : "Preencha sua seção antes de concluir."}
              </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="lg" disabled={!allFilled}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isStaff ? "Concluir relatório" : "Concluir minha parte"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{isStaff ? "Concluir relatório?" : "Concluir sua parte?"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {isStaff
                      ? "O relatório será enviado para revisão da diretoria. Você ainda poderá editar caso seja solicitada uma correção."
                      : "Sua seção será marcada como concluída e o relatório seguirá para a revisão. Você ainda poderá editar caso seja solicitada uma correção."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => updateReport.mutate({ status: "em_revisao" }, { onSuccess: () => navigate({ to: "/reports" }) })}>
                    Concluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      })()}

      {(() => {
        if (!isAdmin) return null;
        if (report.status !== "em_revisao") return null;
        return (
          <div className="flex justify-end pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="lg" variant="default">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Validar revisão
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Validar revisão do relatório?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ao validar, o relatório será marcado como aprovado pela diretoria e ficará disponível para impressão e assinatura.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => updateReport.mutate({ status: "aprovado_diretoria" })}>
                    Validar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      })()}

      {report.status === "aprovado_diretoria" && isRespTecnicoOrAdmin && (
        <Card className="p-4 flex items-center justify-between gap-4 border-emerald-300 bg-emerald-50/50">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="font-medium text-emerald-900">
              Relatório aprovado pela diretoria. Pronto para impressão e coleta de assinaturas.
            </span>
          </div>
          <Button asChild size="lg">
            <a href={`/reports/${reportId}/print?auto=1`} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-2" /> Baixar PDF para assinaturas
            </a>
          </Button>
        </Card>
      )}




      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de modificações</DialogTitle>
            <DialogDescription>Registros de criação, edição e remoção deste relatório.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {!auditLog?.length && <p className="text-muted-foreground text-sm">Sem modificações registradas.</p>}
            {auditLog?.map((a: any) => (
              <div key={a.id} className="text-sm border-l-2 border-primary/30 pl-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.changed_by_name ?? "Usuário"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.action === "INSERT" && (a.table_name === "reports" ? "criou o relatório" : "adicionou seção")}
                  {a.action === "DELETE" && (a.table_name === "reports" ? "excluiu o relatório" : "removeu seção")}
                  {a.action === "UPDATE" && (
                    <span>
                      atualizou: {Object.keys(a.field_changes ?? {}).join(", ") || "—"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({
  section,
  canEdit,
  onSave,
  onDelete,
}: {
  section: any;
  canEdit: boolean;
  onSave: (patch: any) => void;
  onDelete: () => void;
}) {
  const initialContent = isTemplateBoilerplate(section.content) ? "" : section.content ?? "";
  const [content, setContent] = useState(initialContent);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>(section.field_values ?? {});
  const fields: FormField[] = Array.isArray(section.fields) ? section.fields : [];
  const [savedState, setSavedState] = useState<"idle" | "saving" | "saved">("idle");
  const initialRef = useRef({ content: initialContent, field_values: section.field_values ?? {} });

  // Autosave with debounce
  useEffect(() => {
    if (!canEdit) return;
    const valuesDirty = JSON.stringify(fieldValues) !== JSON.stringify(initialRef.current.field_values);
    const contentDirty = content !== initialRef.current.content;
    if (!valuesDirty && !contentDirty) return;
    setSavedState("saving");
    const t = setTimeout(() => {
      onSave({ content, field_values: fieldValues });
      initialRef.current = { content, field_values: fieldValues };
      setSavedState("saved");
      const t2 = setTimeout(() => setSavedState("idle"), 1500);
      return () => clearTimeout(t2);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, fieldValues, canEdit]);

  return (
    <Card id={`section-${section.id}`} className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] space-y-1">
          <h3 className="text-lg font-semibold">{cleanSectionTitle(section.title, section.specialties?.name)}</h3>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
            {!canEdit && (
              <Badge variant="secondary">Somente leitura — área de outro profissional</Badge>
            )}
            {section.specialties?.name && (
              <Badge variant="outline" style={section.specialties.color ? { borderColor: section.specialties.color, color: section.specialties.color } : undefined}>
                {section.specialties.name}
              </Badge>
            )}
            {section.professionals?.full_name && <span>{section.professionals.full_name}</span>}
            <span>Atualizado em {new Date(section.updated_at).toLocaleString("pt-BR")}</span>
            {canEdit && savedState !== "idle" && (
              <span className="text-xs text-muted-foreground">
                {savedState === "saving" ? "Salvando…" : "✓ Salvo"}
              </span>
            )}
          </div>
        </div>
      </div>

      {fields.length > 0 && (
        <div className="border-t pt-3">
          <FieldsRenderer fields={fields} values={fieldValues} onChange={setFieldValues} disabled={!canEdit} />
        </div>
      )}

      <div className={fields.length > 0 ? "border-t pt-3 space-y-1" : ""}>
        {fields.length > 0 && <Label className="text-sm">Observações adicionais</Label>}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!canEdit}
          rows={fields.length > 0 ? 4 : 6}
          placeholder={fields.length > 0 ? "Observações livres (opcional)…" : "Descreva as avaliações, evolução, intervenções e observações relevantes…"}
        />
      </div>
      <SectionSigners sectionId={section.id} reportId={section.report_id} />
    </Card>
  );
}

function cleanSectionTitle(title: string | null | undefined, specialtyName?: string) {
  const cleaned = String(title ?? "").replace(/^Área:\s*/i, "").trim();
  if (!cleaned || cleaned.toLowerCase() === "área do profissional") return specialtyName ?? "Área do profissional";
  return cleaned;
}

function isTemplateBoilerplate(text: string | null | undefined) {
  if (!text) return true;
  const t = text.toLowerCase().trim();
  return ["preencha os anexos", "revisar com ia", "revisar com a ia", "cada bloco abaixo corresponde"].some((p) =>
    t.includes(p),
  );
}

function RequestCorrectionButton({ reportId }: { reportId: string }) {
  const { user, isRespTecnicoOrAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Correção solicitada");
  const [body, setBody] = useState("");
  const { data: professionals } = useQuery({
    queryKey: ["professionals-min"],
    queryFn: async () => (await supabase.from("professionals").select("id, full_name").order("full_name")).data ?? [],
  });
  const [profId, setProfId] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      if (!profId) throw new Error("Selecione o profissional.");
      const { error } = await supabase.from("announcements" as any).insert({
        author_id: user?.id,
        kind: "correcao_relatorio",
        title,
        body: body || null,
        target_type: "professional",
        target_professional_id: profId,
        report_id: reportId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido de correção enviado.");
      setOpen(false);
      setBody("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isRespTecnicoOrAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><AlertCircle className="h-4 w-4 mr-1" /> Pedir correção</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir correção de relatório</DialogTitle>
          <DialogDescription>Envie uma solicitação de ajuste para um profissional.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Profissional *</Label>
            <Select value={profId} onValueChange={setProfId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {professionals?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>O que precisa ser corrigido</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
