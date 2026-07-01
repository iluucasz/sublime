import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button, Card, Input } from "@heroui/react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/sublime-logo.png";
import subliminho from "@/assets/subliminho.png";

const CARGOS = [
  { v: "diretoria", l: "Diretoria", d: "Acesso total: aprova profissionais, libera relatórios, gerencia tudo." },
  { v: "responsavel_tecnico", l: "Responsável Técnico", d: "Acesso amplo: aprova profissionais, revisa e libera relatórios." },
  { v: "profissional_lideranca", l: "Profissional de Liderança", d: "Acesso de liderança: aprova profissionais e acompanha a equipe." },
  { v: "profissional", l: "Profissional", d: "Acesso restrito à sua especialidade. Precisa de aprovação para entrar." },
];

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — ACT Sublime" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cargo, setCargo] = useState("profissional");
  const [specialtyId, setSpecialtyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (mode === "signup" && cargo === "profissional") {
      supabase.from("specialties").select("id,name").order("name").then(({ data }) => setSpecialties(data ?? []));
      supabase.from("units").select("id,name").order("name").then(({ data }) => setUnits(data ?? []));
    }
  }, [mode, cargo]);

  if (!loading && user) return <Navigate to="/dashboard" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo(a) de volta!");
        navigate({ to: "/dashboard" });
      } else {
        if (cargo === "profissional" && (!specialtyId || !unitId)) {
          throw new Error("Selecione sua especialidade e unidade.");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              cargo,
              specialty_id: cargo === "profissional" ? specialtyId : null,
              unit_id: cargo === "profissional" ? unitId : null,
            },
          },
        });
        if (error) throw error;
        if (cargo === "profissional") {
          toast.success("Cadastro enviado! Aguarde aprovação da diretoria para acessar.");
        } else {
          toast.success("Conta criada! Você já pode entrar.");
        }
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao autenticar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-primary via-primary to-[oklch(0.45_0.18_280)] p-12 text-primary-foreground">
        <img src={logo} alt="Sublime" className="h-32 mb-6 bg-white/95 rounded-2xl p-4 shadow-xl" />
        <img src={subliminho} alt="Subliminho" className="h-72 drop-shadow-2xl" />
        <h2 className="mt-6 text-3xl font-bold text-center">ACT Sublime</h2>
        <p className="mt-2 text-center text-primary-foreground/85 max-w-sm">
          Acompanhamento Contínuo Transdisciplinar — pacientes, avaliações, relatórios e estudos de caso, num só lugar.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg">
          <Card.Header className="flex flex-col items-center text-center gap-1">
            <img src={logo} alt="Sublime" className="h-16 mx-auto mb-2 lg:hidden" />
            <Card.Title className="text-2xl">{mode === "login" ? "Entrar" : "Criar conta"}</Card.Title>
            <Card.Description>
              {mode === "login" ? "Acesse o ACT Sublime" : "Cadastre-se para começar"}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <form onSubmit={onSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cargo">Cargo</Label>
                    <select
                      id="cargo"
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                    >
                      {CARGOS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {CARGOS.find((c) => c.v === cargo)?.d}
                    </p>
                  </div>
                  {cargo === "profissional" && (
                    <>
                      <div className="space-y-2">
                        <Label>Especialidade *</Label>
                        <select
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                          value={specialtyId}
                          onChange={(e) => setSpecialtyId(e.target.value)}
                        >
                          <option value="">Selecione sua área</option>
                          {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Unidade *</Label>
                        <select
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                          value={unitId}
                          onChange={(e) => setUnitId(e.target.value)}
                        >
                          <option value="">Selecione a unidade</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" variant="primary" fullWidth isDisabled={submitting}>
                {submitting ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                size="sm"
                className="text-muted-foreground"
                onPress={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
              </Button>
            </form>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
