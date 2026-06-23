import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, NewItemDialog, NewButton } from "@/components/page-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { FileText, Printer, History, Trash2, Pencil, Send, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildSectionsFromTemplateAndGrid } from "@/lib/report-section-utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — ACT Sublime" }] }),
  component: ReportsLayout,
});

export const REPORT_TITLE_OPTIONS = [
  "Relatório 1º semestre",
  "Relatório 2º semestre",
  "Relatório 1º trimestre",
  "Relatório 2º trimestre",
  "Relatório 3º trimestre",
  "Relatório 4º trimestre",
  "Relatório anual",
];

// Duração (em meses) de cada tipo de relatório, usada para calcular
// automaticamente a data de vencimento a partir da data de início.
function periodMonthsForTitle(title: string): number {
  const t = title.toLowerCase();
  if (t.includes("anual")) return 12;
  if (t.includes("semestre")) return 6;
  if (t.includes("trimestre")) return 3;
  return 6;
}

// Adiciona N meses a uma data ISO (yyyy-mm-dd) e retorna ISO.
function addMonthsISO(iso: string, months: number): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Corrige overflow de mês (ex.: 31 -> mês sem dia 31)
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}


const STATUS_LABELS: Record<string, { label: string; variant: any }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  em_revisao: { label: "Enviado para revisão", variant: "outline" },
  encaminhado_diretoria: { label: "Aguardando Diretoria", variant: "secondary" },
  aprovado_diretoria: { label: "Liberado p/ assinatura", variant: "default" },
  assinado: { label: "Assinado", variant: "default" },
  liberado_pais: { label: "Liberado aos pais", variant: "default" },
};

function ReportsLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  if (pathname !== "/reports") return <Outlet />;
  return <ReportsPage />;
}

function ReportsPage() {
  const qc = useQueryClient();
  const { user, hasRole, isRespTecnicoOrAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const isDiretoria = hasRole("diretoria");
  const isProfissionalOnly = !isRespTecnicoOrAdmin && !isAdmin;
  const canChooseTemplate = true;
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [colleaguesReportId, setColleaguesReportId] = useState<string | null>(null);
  // (placeholder removido)
  const [form, setForm] = useState({
    patient_id: "",
    title: "",
    template_id: "",
    period_start: "",
    period_end: "",
  });

  // Profissional vinculado ao usuário atual
  const { data: myProfessional } = useQuery({
    queryKey: ["my-professional-reports", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("professionals")
        .select("id, specialty_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // IDs de relatórios visíveis ao profissional:
  // - relatórios de pacientes em que ele aparece na grade terapêutica
  // - relatórios que contenham uma seção da especialidade dele
  //   (ou cuja seção esteja explicitamente atribuída a ele)
  const { data: myReportIds } = useQuery({
    queryKey: ["my-report-ids", myProfessional?.id, myProfessional?.specialty_id],
    enabled: !!myProfessional?.id,
    queryFn: async () => {
      const ids = new Set<string>();

      const { data: grid } = await supabase
        .from("therapy_grid")
        .select("patient_id")
        .eq("professional_id", myProfessional!.id);
      const patientIds = [...new Set((grid ?? []).map((g: any) => g.patient_id).filter(Boolean))];
      if (patientIds.length) {
        const { data: rep } = await supabase
          .from("reports")
          .select("id")
          .in("patient_id", patientIds);
        (rep ?? []).forEach((r: any) => ids.add(r.id));
      }

      const orFilter = [
        myProfessional!.specialty_id ? `specialty_id.eq.${myProfessional!.specialty_id}` : null,
        `professional_id.eq.${myProfessional!.id}`,
      ]
        .filter(Boolean)
        .join(",");
      if (orFilter) {
        const { data: secs } = await supabase
          .from("report_sections")
          .select("report_id")
          .or(orFilter);
        (secs ?? []).forEach((s: any) => s.report_id && ids.add(s.report_id));
      }

      return [...ids];
    },
  });

  const { data: reports, isLoading, error: reportsError } = useQuery({
    queryKey: ["reports", isProfissionalOnly ? myReportIds : "all"],
    enabled: !isProfissionalOnly || !!myProfessional,
    queryFn: async () => {
      let q = supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (isProfissionalOnly) {
        if (!myReportIds?.length) return [];
        q = q.in("id", myReportIds);
      }
      const { data, error } = await q;
      if (error) throw error;

      const patientIds = [...new Set((data ?? []).map((report: any) => report.patient_id).filter(Boolean))];
      if (!patientIds.length) return data ?? [];

      const { data: patientRows, error: patientError } = await supabase
        .from("patients")
        .select("id, full_name")
        .in("id", patientIds);
      if (patientError) throw patientError;

      const patientsById = new Map((patientRows ?? []).map((patient: any) => [patient.id, patient]));

      return (data ?? []).map((report: any) => ({
        ...report,
        patients: patientsById.get(report.patient_id) ?? null,
      }));
    },
  });

  // Assinaturas por relatório (X/Y assinaram)
  const visibleReportIds = (reports ?? []).map((r: any) => r.id);
  const { data: signersByReport } = useQuery({
    queryKey: ["report-signers-summary", visibleReportIds.join(",")],
    enabled: visibleReportIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_signers")
        .select("report_id, signed_at, professional_id")
        .in("report_id", visibleReportIds);
      if (error) throw error;
      const profIds = [...new Set((data ?? []).map((r: any) => r.professional_id).filter(Boolean))];
      const profMap = new Map<string, any>();
      if (profIds.length) {
        const { data: profs } = await supabase
          .from("professionals")
          .select("id, full_name")
          .in("id", profIds);
        (profs ?? []).forEach((p: any) => profMap.set(p.id, p));
      }
      const map = new Map<string, { total: number; signed: number; signers: any[] }>();
      (data ?? []).forEach((row: any) => {
        const entry = map.get(row.report_id) ?? { total: 0, signed: 0, signers: [] };
        entry.total += 1;
        if (row.signed_at) entry.signed += 1;
        entry.signers.push({ ...row, full_name: profMap.get(row.professional_id)?.full_name ?? "—" });
        map.set(row.report_id, entry);
      });
      return map;
    },
  });

  function daysSince(iso?: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86_400_000);
  }


  // Encaminhar para diretoria
  const encaminhar = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("reports")
        .update({ status: "encaminhado_diretoria" as any })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório encaminhado para a Diretoria.");
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: patients } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () =>
      (await supabase.from("patients").select("id, full_name").order("full_name")).data ?? [],
  });

  const { data: templates } = useQuery({
    queryKey: ["report_templates-min"],
    queryFn: async () =>
      (await supabase.from("report_templates").select("id, name").eq("status", "ativo").order("name")).data ?? [],
  });

  const { data: selectedPatientGrid, isLoading: loadingGrid } = useQuery({
    queryKey: ["new-report-grid-check", form.patient_id],
    enabled: !!form.patient_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapy_grid")
        .select("id")
        .eq("patient_id", form.patient_id)
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
  });
  const hasGrid = !!selectedPatientGrid?.length;

  const { data: selectedPatientInfo, isLoading: loadingPatientInfo } = useQuery({
    queryKey: ["new-report-patient-info", form.patient_id],
    enabled: !!form.patient_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("birth_date, main_diagnosis, guardian_name, guardian_phone, unit_id")
        .eq("id", form.patient_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const patientRequiredFields: { key: string; label: string }[] = [
    { key: "birth_date", label: "Data de nascimento" },
    { key: "main_diagnosis", label: "Diagnóstico / CID" },
    { key: "guardian_name", label: "Responsável" },
    { key: "guardian_phone", label: "Contato" },
    { key: "unit_id", label: "Unidade" },
  ];
  const missingPatientFields = selectedPatientInfo
    ? patientRequiredFields
        .filter((f) => {
          const v = (selectedPatientInfo as any)?.[f.key];
          return v === null || v === undefined || v === "";
        })
        .map((f) => f.label)
    : [];
  const patientInfoComplete = !!selectedPatientInfo && missingPatientFields.length === 0;

  const openReport = (reportId: string) => {
    navigate({
      to: "/reports/$reportId",
      params: { reportId },
      hash: "preencher",
    });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!form.patient_id || !form.title) throw new Error("Paciente e título são obrigatórios.");
      if (!hasGrid) throw new Error("Não é possível criar o relatório: o paciente não possui grade terapêutica cadastrada.");
      if (!patientInfoComplete) {
        throw new Error(
          `Não é possível criar o relatório: faltam informações do paciente (${missingPatientFields.join(", ")}). Edite o cadastro do paciente.`,
        );
      }
      const payload: any = {
        patient_id: form.patient_id,
        title: form.title,
        created_by: user?.id,
      };
      if (form.template_id) payload.template_id = form.template_id;
      if (form.period_start) payload.period_start = form.period_start;
      if (form.period_end) payload.period_end = form.period_end;
      const { data, error } = await supabase.from("reports").insert(payload).select("id").single();
      if (error) throw error;

      const [{ data: modules }, { data: grid }, { data: patient }] = await Promise.all([
        form.template_id
          ? supabase
              .from("report_template_modules")
              .select("title, specialty_id, description, order_index, fields")
              .eq("template_id", form.template_id)
              .order("order_index")
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("therapy_grid")
          .select("specialty_id, professional_id")
          .eq("patient_id", form.patient_id),
        supabase
          .from("patients")
          .select("full_name, birth_date, main_diagnosis, guardian_name, guardian_phone")
          .eq("id", form.patient_id)
          .maybeSingle(),
      ]);

      if (data?.id) {
        const rows = buildSectionsFromTemplateAndGrid({
          modules,
          grid,
          reportId: data.id,
          userId: user?.id,
          patient,
          period: { start: form.period_start, end: form.period_end },
        });
        if (rows.length) {
          const { error: sectionsError } = await supabase.from("report_sections").insert(rows);
          if (sectionsError) throw sectionsError;
        }
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success("Relatório criado.");
      qc.invalidateQueries({ queryKey: ["reports"] });
      setOpen(false);
      setForm({ patient_id: "", title: "", template_id: "", period_start: "", period_end: "" });
      if (data?.id) openReport(data.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório excluído.");
      qc.invalidateQueries({ queryKey: ["reports"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Relatórios por paciente e período. Cada profissional adiciona sua seção."
        action={!isProfissionalOnly ? <NewButton onClick={() => setOpen(true)} label="Novo relatório" /> : null}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : reportsError ? (
          <div className="p-8 text-center text-destructive">
            Não foi possível carregar os relatórios: {(reportsError as Error).message}
          </div>
        ) : !reports?.length ? (
          <EmptyState
            title="Nenhum relatório ainda"
            description="Crie o primeiro relatório para começar a registrar as avaliações dos profissionais."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Aberto há</TableHead>
                <TableHead>Assinaturas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r: any) => {
                const st = STATUS_LABELS[r.status] ?? { label: r.status, variant: "secondary" };
                const days = daysSince(r.created_at);
                const sigInfo = signersByReport?.get(r.id);
                const isClosed = r.status === "aprovado_diretoria" || r.status === "liberado_pais";
                const overdue = !isClosed && days !== null && days >= 30;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.patients?.full_name ?? "—"}</TableCell>
                    <TableCell>{r.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.period_start ? new Date(r.period_start).toLocaleDateString("pt-BR") : "—"}
                      {" → "}
                      {r.period_end ? new Date(r.period_end).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {isClosed ? (
                        <span className="text-muted-foreground">—</span>
                      ) : days === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={overdue ? "destructive" : days >= 14 ? "outline" : "secondary"}>
                          {days} {days === 1 ? "dia" : "dias"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sigInfo && sigInfo.total > 0 ? (
                        <div
                          className="inline-flex items-center gap-1"
                          title={sigInfo.signers
                            .map((s: any) => `${s.full_name}${s.signed_at ? " ✓" : " (pendente)"}`)
                            .join("\n")}
                        >
                          <Badge variant={sigInfo.signed === sigInfo.total ? "default" : "outline"}>
                            {sigInfo.signed}/{sigInfo.total}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">sem assinantes</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost" title="Histórico">
                          <Link to="/reports/$reportId" params={{ reportId: r.id }} hash="historico">
                            <History className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost" title="Imprimir">
                          <Link to="/reports/$reportId/print" params={{ reportId: r.id }}>
                            <Printer className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Consultar colegas"
                          onClick={() => setColleaguesReportId(r.id)}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/reports/$reportId" params={{ reportId: r.id }} hash="preencher">
                            <FileText className="h-4 w-4 mr-1" /> Abrir
                          </Link>
                        </Button>
                        {(isRespTecnicoOrAdmin || r.created_by === user?.id) && (
                          <Button asChild size="sm" variant="ghost" title="Editar">
                            <Link to="/reports/$reportId" params={{ reportId: r.id }} hash="preencher">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {isDiretoria && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Excluir"
                            onClick={() => setDeleteId(r.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {isRespTecnicoOrAdmin && reports?.length ? <PendenciasPanel reports={reports} /> : null}



      <NewItemDialog
        title="Novo relatório"
        open={open}
        onOpenChange={setOpen}
        submitting={create.isPending}
        onSubmit={() => create.mutate()}
        submitDisabled={!form.patient_id || !hasGrid || loadingGrid || loadingPatientInfo || !patientInfoComplete}
      >
        <div>
          <Label>Paciente *</Label>
          <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
            <SelectContent>
              {patients?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.patient_id && (
            <div className="mt-1 space-y-1">
              {loadingGrid ? (
                <p className="text-xs text-muted-foreground">Verificando grade terapêutica…</p>
              ) : hasGrid ? (
                <p className="text-xs text-emerald-600">✓ Paciente possui grade terapêutica.</p>
              ) : (
                <p className="text-xs text-destructive">
                  Este paciente não possui grade terapêutica. Cadastre a grade antes de criar o relatório.
                </p>
              )}
              {loadingPatientInfo ? (
                <p className="text-xs text-muted-foreground">Verificando informações do paciente…</p>
              ) : patientInfoComplete ? (
                <p className="text-xs text-emerald-600">✓ Informações do paciente completas.</p>
              ) : (
                <p className="text-xs text-destructive">
                  Informações do paciente incompletas: {missingPatientFields.join(", ")}. Edite o cadastro do paciente antes de criar o relatório.
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <Label>Tipo de relatório *</Label>
          <Select
            value={form.title}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                title: v,
                period_end: f.period_start
                  ? addMonthsISO(f.period_start, periodMonthsForTitle(v))
                  : f.period_end,
              }))
            }
          >
            <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
            <SelectContent>
              {REPORT_TITLE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canChooseTemplate && (
          <div>
            <Label>Modelo de relatório (opcional)</Label>
            <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sem modelo" /></SelectTrigger>
              <SelectContent>
                {templates?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Apenas diretoria, RT e profissionais de liderança podem direcionar um modelo. Os módulos do modelo serão copiados para o relatório e ficarão disponíveis para o profissional preencher.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data de preenchimento (início)</Label>
            <Input
              type="date"
              value={form.period_start}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  period_start: e.target.value,
                  period_end: e.target.value
                    ? addMonthsISO(e.target.value, periodMonthsForTitle(f.title))
                    : "",
                }))
              }
            />
          </div>
          <div>
            <Label>Vencimento (fim do período)</Label>
            <Input type="date" value={form.period_end} readOnly disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground mt-1">
              Calculado automaticamente a partir da data de preenchimento e do tipo de relatório.
            </p>
          </div>

        </div>
      </NewItemDialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o relatório e todas as suas seções permanentemente. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && remove.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ColleaguesDialog
        reportId={colleaguesReportId}
        open={!!colleaguesReportId}
        onClose={() => setColleaguesReportId(null)}
      />
    </div>
  );
}

function ColleaguesDialog({
  reportId,
  open,
  onClose,
}: {
  reportId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { data: myProf } = useQuery({
    queryKey: ["my-professional-min", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("professionals")
        .select("id, specialty_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: sections } = useQuery({
    queryKey: ["colleague-sections", reportId],
    enabled: !!reportId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sections")
        .select("*")
        .eq("report_id", reportId!)
        .order("order_index");
      if (error) throw error;

      const specialtyIds = [...new Set((data ?? []).map((s: any) => s.specialty_id).filter(Boolean))];
      const professionalIds = [...new Set((data ?? []).map((s: any) => s.professional_id).filter(Boolean))];

      const [{ data: specs }, { data: profs }] = await Promise.all([
        specialtyIds.length
          ? supabase.from("specialties").select("id, name, color").in("id", specialtyIds)
          : Promise.resolve({ data: [] as any[] }),
        professionalIds.length
          ? supabase.from("professionals").select("id, full_name").in("id", professionalIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const specMap = new Map((specs ?? []).map((s: any) => [s.id, s]));
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((s: any) => ({
        ...s,
        specialty: s.specialty_id ? specMap.get(s.specialty_id) : null,
        professional: s.professional_id ? profMap.get(s.professional_id) : null,
      }));
    },
  });

  // Exclui a própria seção (já é visível na tela do relatório)
  const colleagueSections = (sections ?? []).filter((s: any) => {
    if (!s.specialty_id) return true; // seções comuns também aparecem
    if (myProf?.id && s.professional_id === myProf.id) return false;
    if (myProf?.specialty_id && s.specialty_id === myProf.specialty_id) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatórios dos colegas</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Somente leitura. Visualize o que outros profissionais escreveram sobre este paciente.</p>
        <div className="space-y-3">
          {!colleagueSections.length && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma seção de colega disponível ainda.
            </p>
          )}
          {colleagueSections.map((s: any) => (
            <Card key={s.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{s.title}</span>
                {s.specialty?.name && (
                  <Badge
                    variant="outline"
                    style={s.specialty.color ? { borderColor: s.specialty.color, color: s.specialty.color } : undefined}
                  >
                    {s.specialty.name}
                  </Badge>
                )}
                {s.professional?.full_name && (
                  <span className="text-xs text-muted-foreground">{s.professional.full_name}</span>
                )}
              </div>
              {s.content && (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{s.content}</p>
              )}
              {!s.content && (!s.field_values || !Object.keys(s.field_values).length) && (
                <p className="text-xs text-muted-foreground italic">Sem conteúdo preenchido.</p>
              )}
              {s.field_values && Object.keys(s.field_values).length > 0 && (
                <div className="text-xs space-y-1 border-t pt-2">
                  {Object.entries(s.field_values).map(([k, v]: any) => (
                    <div key={k}>
                      <span className="font-medium">{k}:</span>{" "}
                      <span className="text-muted-foreground">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Painel de pendências (RT / Diretoria / PL)
// Mostra, por relatório aberto, quais especialidades já preencheram e quais
// faltam — com botão "Cobrar" que cria um aviso direcionado ao profissional.
// ---------------------------------------------------------------------------
function PendenciasPanel({ reports }: { reports: any[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const openReports = reports.filter(
    (r: any) => r.status !== "aprovado_diretoria" && r.status !== "liberado_pais"
  );
  const reportIds = openReports.map((r: any) => r.id);
  const patientIds = [...new Set(openReports.map((r: any) => r.patient_id).filter(Boolean))];

  const { data: sections } = useQuery({
    queryKey: ["pendencias-sections", reportIds.join(",")],
    queryFn: async () => {
      if (!reportIds.length) return [];
      const { data } = await supabase
        .from("report_sections")
        .select("id, report_id, specialty_id, professional_id, content, field_values")
        .in("report_id", reportIds);
      return data ?? [];
    },
    enabled: reportIds.length > 0,
  });

  const { data: grid } = useQuery({
    queryKey: ["pendencias-grid", patientIds.join(",")],
    queryFn: async () => {
      if (!patientIds.length) return [];
      const { data } = await supabase
        .from("therapy_grid")
        .select("patient_id, specialty_id, professional_id")
        .in("patient_id", patientIds);
      return data ?? [];
    },
    enabled: patientIds.length > 0,
  });

  const { data: specialties } = useQuery({
    queryKey: ["specialties-min"],
    queryFn: async () => (await supabase.from("specialties").select("id, name").order("name")).data ?? [],
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals-pendencias"],
    queryFn: async () =>
      (await supabase.from("professionals").select("id, full_name, specialty_id").order("full_name")).data ?? [],
  });

  const cobrar = useMutation({
    mutationFn: async (args: { reportId: string; patientId: string; professionalId: string; specialtyName: string; patientName: string }) => {
      const { error } = await supabase.from("announcements" as any).insert({
        author_id: user?.id,
        kind: "cobranca_relatorio",
        title: `Faltando: ${args.specialtyName} — ${args.patientName}`,
        body: `Por favor, preencha sua seção (${args.specialtyName}) do relatório de ${args.patientName}.`,
        target_type: "professional",
        target_professional_id: args.professionalId,
        report_id: args.reportId,
        patient_id: args.patientId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cobrança enviada ao profissional.");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!sections || !grid || !openReports.length) return null;

  const specMap = new Map((specialties ?? []).map((s: any) => [s.id, s.name]));
  const profMap = new Map((professionals ?? []).map((p: any) => [p.id, p]));

  // Pendência = especialidade na grade do paciente sem seção preenchida no relatório.
  const sectionIsFilled = (sec: any) => {
    const hasContent = !!(sec.content && sec.content.trim());
    const hasValues = sec.field_values && Object.keys(sec.field_values).length > 0;
    return hasContent || hasValues;
  };

  type Row = {
    report: any;
    expected: { specialtyId: string; professionalId: string | null }[];
    filledSpecIds: Set<string>;
  };

  const rows: Row[] = openReports.map((r: any) => {
    const reportSections = (sections as any[]).filter((s) => s.report_id === r.id);
    const filledSpecIds = new Set<string>(
      reportSections.filter(sectionIsFilled).map((s) => s.specialty_id).filter(Boolean)
    );
    const gridRows = (grid as any[]).filter((g) => g.patient_id === r.patient_id);
    const seen = new Set<string>();
    const expected: { specialtyId: string; professionalId: string | null }[] = [];
    gridRows.forEach((g) => {
      if (!g.specialty_id || seen.has(g.specialty_id)) return;
      seen.add(g.specialty_id);
      expected.push({ specialtyId: g.specialty_id, professionalId: g.professional_id ?? null });
    });
    return { report: r, expected, filledSpecIds };
  });

  const anyPending = rows.some((row) => row.expected.some((e) => !row.filledSpecIds.has(e.specialtyId)));

  return (
    <Card className="mt-6 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-base">Pendências de preenchimento</h3>
          <p className="text-xs text-muted-foreground">
            Baseado na grade terapêutica de cada paciente.
          </p>
        </div>
      </div>

      {!anyPending ? (
        <p className="text-sm text-muted-foreground">Nenhuma pendência. Todos os profissionais preencheram suas seções.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const pending = row.expected.filter((e) => !row.filledSpecIds.has(e.specialtyId));
            const done = row.expected.filter((e) => row.filledSpecIds.has(e.specialtyId));
            if (!row.expected.length) return null;
            return (
              <div key={row.report.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div>
                    <span className="font-medium">{row.report.patients?.full_name ?? "—"}</span>
                    <span className="text-muted-foreground text-sm"> · {row.report.title}</span>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/reports/$reportId" params={{ reportId: row.report.id }} hash="preencher">
                      <FileText className="h-3.5 w-3.5 mr-1" /> Abrir
                    </Link>
                  </Button>
                </div>

                {pending.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Faltam ({pending.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pending.map((p) => {
                        const specName = specMap.get(p.specialtyId) ?? "—";
                        // Resolve profissional: grade > primeiro profissional da especialidade
                        let profId = p.professionalId;
                        if (!profId) {
                          const candidate = (professionals ?? []).find(
                            (pr: any) => pr.specialty_id === p.specialtyId
                          );
                          profId = candidate?.id ?? null;
                        }
                        const prof = profId ? profMap.get(profId) : null;
                        return (
                          <div key={p.specialtyId} className="flex items-center gap-1 border rounded-full pl-2.5 pr-1 py-0.5 text-xs bg-destructive/5 border-destructive/20">
                            <span className="font-medium">{specName}</span>
                            {prof && <span className="text-muted-foreground">· {(prof as any).full_name}</span>}
                            {profId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 ml-1"
                                onClick={() =>
                                  cobrar.mutate({
                                    reportId: row.report.id,
                                    patientId: row.report.patient_id,
                                    professionalId: profId!,
                                    specialtyName: specName,
                                    patientName: row.report.patients?.full_name ?? "paciente",
                                  })
                                }
                                disabled={cobrar.isPending}
                              >
                                Cobrar
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {done.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Preenchidas ({done.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {done.map((p) => (
                        <Badge key={p.specialtyId} variant="secondary" className="text-xs">
                          {specMap.get(p.specialtyId) ?? "—"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
