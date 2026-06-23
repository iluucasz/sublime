import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-shell";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/meu-perfil")({
  head: () => ({ meta: [{ title: "Meu Perfil — ACT Sublime" }] }),
  component: MyProfilePage,
});

const COUNCILS = ["CRP", "CREFITO", "CRFa", "CRM", "CRN", "CREF", "CRESS", "Outro"];

function MyProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [registerForm, setRegisterForm] = useState({
    full_name: "",
    specialty_id: "",
    unit_id: "",
  });

  const { data: prof, isLoading, error: profError } = useQuery({
    queryKey: ["my-professional", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const [specialty, unit] = await Promise.all([
        data.specialty_id
          ? supabase.from("specialties").select("id, name").eq("id", data.specialty_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        data.unit_id
          ? supabase.from("units").select("id, name").eq("id", data.unit_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (specialty.error) throw specialty.error;
      if (unit.error) throw unit.error;

      return {
        ...data,
        specialties: specialty.data,
        units: unit.data,
      };
    },
    enabled: !!user?.id,
  });

  const [form, setForm] = useState({
    full_name: "", cpf: "", phone: "", council_type: "", council_number: "", schedule_text: "", specialty_id: "", unit_id: "",
  });

  const { data: specialties } = useQuery({
    queryKey: ["profile-specialties"],
    queryFn: async () => (await supabase.from("specialties").select("id, name").order("name")).data ?? [],
  });

  const { data: units } = useQuery({
    queryKey: ["profile-units"],
    queryFn: async () => (await supabase.from("units").select("id, name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (prof) {
      setForm({
        full_name: prof.full_name ?? "",
        cpf: prof.cpf ?? "",
        phone: prof.phone ?? "",
        council_type: prof.council_type ?? "",
        council_number: prof.council_number ?? "",
        schedule_text: prof.schedule_text ?? "",
        specialty_id: prof.specialty_id ?? "",
        unit_id: prof.unit_id ?? "",
      });
    }
  }, [prof]);

  useEffect(() => {
    if (user && !prof) {
      setRegisterForm((current) => ({
        ...current,
        full_name: current.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "",
      }));
    }
  }, [prof, user]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("professionals")
        .update({
          full_name: form.full_name,
          cpf: form.cpf || null,
          phone: form.phone || null,
          council_type: form.council_type || null,
          council_number: form.council_number || null,
          schedule_text: form.schedule_text || null,
          specialty_id: form.specialty_id || null,
          unit_id: form.unit_id || null,
        })
        .eq("id", prof!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["my-professional"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não identificado.");
      if (!registerForm.full_name || !registerForm.specialty_id || !registerForm.unit_id) {
        throw new Error("Preencha nome, especialidade e unidade.");
      }

      const { error } = await supabase.from("professionals").insert({
        user_id: user.id,
        full_name: registerForm.full_name,
        email: user.email ?? null,
        specialty_id: registerForm.specialty_id,
        unit_id: registerForm.unit_id,
        admission_date: new Date().toISOString().slice(0, 10),
        status: "pendente",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadastro profissional criado. Agora ele seguirá para aprovação.");
      qc.invalidateQueries({ queryKey: ["my-professional"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function uploadFile(kind: "stamp" | "signature", file: File) {
    if (!prof) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${prof.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("professional-stamps")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) return toast.error(upErr.message);
    const { data: pub } = supabase.storage.from("professional-stamps").getPublicUrl(path);
    const col = kind === "stamp" ? "stamp_url" : "signature_url";
    const update: any = { [col]: pub.publicUrl };
    const { error } = await supabase.from("professionals").update(update).eq("id", prof.id);
    if (error) return toast.error(error.message);
    toast.success(`${kind === "stamp" ? "Carimbo" : "Assinatura"} enviado`);
    qc.invalidateQueries({ queryKey: ["my-professional"] });
  }

  if (isLoading) return <div className="text-muted-foreground">Carregando…</div>;

  if (profError) return <div className="text-destructive">Não foi possível carregar seu perfil: {(profError as Error).message}</div>;

  if (!prof) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Meu Perfil"
          description="Complete seu cadastro profissional para liberar seu acesso interno."
        />

        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold">Cadastro profissional</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Não encontramos um cadastro vinculado à sua conta. Você pode concluir o cadastro aqui.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome completo *</Label>
              <Input
                value={registerForm.full_name}
                onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Especialidade *</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={registerForm.specialty_id}
                onChange={(e) => setRegisterForm({ ...registerForm, specialty_id: e.target.value })}
              >
                <option value="">Selecione</option>
                {specialties?.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={registerForm.unit_id}
                onChange={(e) => setRegisterForm({ ...registerForm, unit_id: e.target.value })}
              >
                <option value="">Selecione</option>
                {units?.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => createProfile.mutate()} disabled={createProfile.isPending}>
              {createProfile.isPending ? "Salvando…" : "Concluir cadastro"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const pending = prof.status === "pendente";

  return (
    <div>
      <PageHeader
        title="Meu Perfil"
        description="Mantenha seus dados profissionais atualizados."
        action={
          pending ? (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              Aguardando aprovação
            </Badge>
          ) : prof.status === "ativo" ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">Ativo</Badge>
          ) : (
            <Badge variant="outline">Desligado</Badge>
          )
        }
      />

      {pending && (
        <Card className="p-4 mb-4 border-amber-300 bg-amber-50/60">
          <p className="text-sm text-amber-900">
            Seu cadastro foi recebido e está aguardando liberação da diretoria, responsável técnico ou profissional de
            liderança. Você poderá completar seus dados, mas só verá pacientes e avaliações após a aprovação.
          </p>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome completo *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={prof.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de conselho</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={form.council_type}
              onChange={(e) => setForm({ ...form, council_type: e.target.value })}
            >
              <option value="">Selecione</option>
              {COUNCILS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Número do conselho</Label>
            <Input value={form.council_number} onChange={(e) => setForm({ ...form, council_number: e.target.value })} placeholder="Ex: 12345/RJ" />
          </div>
          <div className="space-y-2">
            <Label>Especialidade</Label>
            <Select value={form.specialty_id} onValueChange={(value) => setForm({ ...form, specialty_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a especialidade" />
              </SelectTrigger>
              <SelectContent>
                {specialties?.map((specialty) => (
                  <SelectItem key={specialty.id} value={specialty.id}>{specialty.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={form.unit_id} onValueChange={(value) => setForm({ ...form, unit_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units?.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Horários / Escala</Label>
            <Input value={form.schedule_text} onChange={(e) => setForm({ ...form, schedule_text: e.target.value })} placeholder="Seg: 08-18, Ter: 13-18..." />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar dados"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 mt-4 space-y-4">
        <div>
          <h3 className="font-semibold">Carimbo e Assinatura</h3>
          <p className="text-xs text-muted-foreground">PNG com fundo transparente funciona melhor nos relatórios impressos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Carimbo</Label>
            <div className="border rounded-md p-3 h-32 flex items-center justify-center bg-muted/40">
              {prof.stamp_url ? <img src={prof.stamp_url} alt="" className="max-h-full" /> : <span className="text-xs text-muted-foreground">Sem carimbo</span>}
            </div>
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("stamp", e.target.files[0])} />
          </div>
          <div className="space-y-2">
            <Label>Assinatura</Label>
            <div className="border rounded-md p-3 h-32 flex items-center justify-center bg-muted/40">
              {prof.signature_url ? <img src={prof.signature_url} alt="" className="max-h-full" /> : <span className="text-xs text-muted-foreground">Sem assinatura</span>}
            </div>
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("signature", e.target.files[0])} />
          </div>
        </div>
      </Card>
    </div>
  );
}
