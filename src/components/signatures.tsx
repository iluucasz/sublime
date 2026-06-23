import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { PenLine, UserPlus, X, CheckCircle2 } from "lucide-react";

/** Hook: returns the professional id linked to current user, or null */
export function useMyProfessionalId() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-professional-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("professionals")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!user,
  });
  return data ?? null;
}

/** Final report signers (whole report) */
export function ReportSignersCard({ reportId }: { reportId: string }) {
  const qc = useQueryClient();
  const { isRespTecnicoOrAdmin, user } = useAuth();
  const myProfId = useMyProfessionalId();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState({ professional_id: "", role_label: "" });

  const { data: signers } = useQuery({
    queryKey: ["report-signers", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_signers")
        .select("*")
        .eq("report_id", reportId)
        .order("order_index");
      if (error) throw error;

      const professionalIds = [...new Set((data ?? []).map((signer: any) => signer.professional_id).filter(Boolean))];
      if (!professionalIds.length) return data ?? [];

      const { data: professionalRows, error: professionalsError } = await supabase
        .from("professionals")
        .select("id, full_name")
        .in("id", professionalIds);
      if (professionalsError) throw professionalsError;

      const professionalsById = new Map((professionalRows ?? []).map((professional: any) => [professional.id, professional]));
      return (data ?? []).map((signer: any) => ({
        ...signer,
        professionals: signer.professional_id ? professionalsById.get(signer.professional_id) ?? null : null,
      }));
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals-min"],
    queryFn: async () =>
      (await supabase.from("professionals").select("id, full_name").order("full_name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!pick.professional_id) throw new Error("Selecione um profissional");
      const { error } = await supabase.from("report_signers").insert({
        report_id: reportId,
        professional_id: pick.professional_id,
        role_label: pick.role_label || null,
        order_index: signers?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-signers", reportId] });
      setPick({ professional_id: "", role_label: "" });
      setOpen(false);
      toast.success("Assinante adicionado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_signers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-signers", reportId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const sign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("report_signers")
        .update({ signed_at: new Date().toISOString(), signed_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["report-signers", reportId] });
      toast.success("Assinatura registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Assinantes do relatório</h3>
          <p className="text-xs text-muted-foreground">Profissionais que devem assinar o relatório completo.</p>
        </div>
        {isRespTecnicoOrAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><UserPlus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo assinante</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Profissional *</Label>
                  <Select value={pick.professional_id} onValueChange={(v) => setPick({ ...pick, professional_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {professionals?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Função na assinatura</Label>
                  <Input
                    placeholder="Ex.: Responsável Técnico, Diretoria"
                    value={pick.role_label}
                    onChange={(e) => setPick({ ...pick, role_label: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => add.mutate()} disabled={add.isPending}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!signers?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum assinante definido.</p>
      ) : (
        <div className="space-y-2">
          {signers.map((s: any) => {
            const isSigned = !!s.signed_at;
            const canSign = !isSigned && s.professional_id === myProfId;
            return (
              <div key={s.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  {isSigned
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    : <PenLine className="h-4 w-4 text-amber-600" />}
                  <span className="font-medium">{s.professionals?.full_name}</span>
                  {s.role_label && <Badge variant="outline">{s.role_label}</Badge>}
                  {isSigned
                    ? <span className="text-xs text-muted-foreground">Assinou em {new Date(s.signed_at).toLocaleString("pt-BR")}</span>
                    : <span className="text-xs text-amber-700">Aguardando assinatura</span>}
                </div>
                <div className="flex gap-1">
                  {canSign && (
                    <Button size="sm" onClick={() => sign.mutate(s.id)} disabled={sign.isPending}>
                      <PenLine className="h-4 w-4 mr-1" /> Assinar
                    </Button>
                  )}
                  {isRespTecnicoOrAdmin && !isSigned && (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** Per-section signers (compact, inline in SectionCard) */
export function SectionSigners({ sectionId, reportId }: { sectionId: string; reportId: string }) {
  const qc = useQueryClient();
  const { isRespTecnicoOrAdmin, user } = useAuth();
  const myProfId = useMyProfessionalId();
  const [open, setOpen] = useState(false);
  const [pickId, setPickId] = useState("");

  const { data: signers } = useQuery({
    queryKey: ["section-signers", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_section_signers")
        .select("*")
        .eq("section_id", sectionId);
      if (error) throw error;

      const professionalIds = [...new Set((data ?? []).map((signer: any) => signer.professional_id).filter(Boolean))];
      if (!professionalIds.length) return data ?? [];

      const { data: professionalRows, error: professionalsError } = await supabase
        .from("professionals")
        .select("id, full_name")
        .in("id", professionalIds);
      if (professionalsError) throw professionalsError;

      const professionalsById = new Map((professionalRows ?? []).map((professional: any) => [professional.id, professional]));
      return (data ?? []).map((signer: any) => ({
        ...signer,
        professionals: signer.professional_id ? professionalsById.get(signer.professional_id) ?? null : null,
      }));
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals-min"],
    queryFn: async () =>
      (await supabase.from("professionals").select("id, full_name").order("full_name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!pickId) throw new Error("Selecione um profissional");
      const { error } = await supabase.from("report_section_signers").insert({
        section_id: sectionId,
        report_id: reportId,
        professional_id: pickId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["section-signers", sectionId] });
      setPickId("");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_section_signers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["section-signers", sectionId] }),
  });

  const sign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("report_section_signers")
        .update({ signed_at: new Date().toISOString(), signed_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["section-signers", sectionId] });
      toast.success("Assinatura registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
      <span className="text-xs font-medium text-muted-foreground">Assinaturas:</span>
      {!signers?.length && <span className="text-xs text-muted-foreground">nenhuma</span>}
      {signers?.map((s: any) => {
        const isSigned = !!s.signed_at;
        const canSign = !isSigned && s.professional_id === myProfId;
        return (
          <div key={s.id} className="flex items-center gap-1">
            <Badge variant={isSigned ? "secondary" : "outline"} className={isSigned ? "bg-emerald-100 text-emerald-700" : "border-amber-400 text-amber-700"}>
              {isSigned ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <PenLine className="h-3 w-3 mr-1" />}
              {s.professionals?.full_name}
            </Badge>
            {canSign && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => sign.mutate(s.id)}>
                Assinar
              </Button>
            )}
            {isRespTecnicoOrAdmin && !isSigned && (
              <button type="button" onClick={() => remove.mutate(s.id)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
      {isRespTecnicoOrAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
              <UserPlus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Definir assinante da seção</DialogTitle></DialogHeader>
            <Select value={pickId} onValueChange={setPickId}>
              <SelectTrigger><SelectValue placeholder="Selecione um profissional" /></SelectTrigger>
              <SelectContent>
                {professionals?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => add.mutate()} disabled={add.isPending}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Pending signatures alert for the current user — dashboard widget */
export function PendingSignaturesAlert() {
  const myProfId = useMyProfessionalId();
  const { data: sectionPending } = useQuery({
    queryKey: ["pending-section-sigs", myProfId],
    queryFn: async () => {
      if (!myProfId) return [];
      const { data } = await supabase
        .from("report_section_signers")
        .select("id, report_id, section_id, report_sections(title), reports(title, patients(full_name))")
        .eq("professional_id", myProfId)
        .is("signed_at", null);
      return data ?? [];
    },
    enabled: !!myProfId,
  });
  const { data: reportPending } = useQuery({
    queryKey: ["pending-report-sigs", myProfId],
    queryFn: async () => {
      if (!myProfId) return [];
      const { data } = await supabase
        .from("report_signers")
        .select("id, report_id, role_label, reports(title, patients(full_name))")
        .eq("professional_id", myProfId)
        .is("signed_at", null);
      return data ?? [];
    },
    enabled: !!myProfId,
  });

  const total = (sectionPending?.length ?? 0) + (reportPending?.length ?? 0);
  if (!myProfId || total === 0) return null;

  return (
    <Card className="p-4 border-amber-300 bg-amber-50/50">
      <div className="flex items-start gap-3">
        <PenLine className="h-5 w-5 text-amber-600 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-amber-900">Assinaturas pendentes ({total})</h3>
            <p className="text-xs text-amber-800">Você tem relatórios aguardando sua assinatura.</p>
          </div>
          <div className="space-y-1">
            {reportPending?.map((r: any) => (
              <a key={r.id} href={`/reports/${r.report_id}`} className="block text-sm hover:underline">
                • {r.reports?.title} {r.role_label && <span className="text-muted-foreground">({r.role_label})</span>} — {r.reports?.patients?.full_name}
              </a>
            ))}
            {sectionPending?.map((s: any) => (
              <a key={s.id} href={`/reports/${s.report_id}`} className="block text-sm hover:underline">
                • {s.reports?.title} → seção "{s.report_sections?.title}" — {s.reports?.patients?.full_name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
