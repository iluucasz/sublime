import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/sublime-logo.png";

export const Route = createFileRoute("/definir-senha")({
  head: () => ({ meta: [{ title: "Definir senha — ACT Sublime" }] }),
  component: DefinirSenhaPage,
});

function traduzirErroSenha(msg?: string): string {
  if (!msg) return "Erro ao definir senha.";
  const m = msg.toLowerCase();
  if (m.includes("different from the old password")) return "A nova senha deve ser diferente da senha anterior.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("auth session missing")) return "Sessão expirada. Solicite um novo convite.";
  if (m.includes("weak password") || m.includes("password strength")) return "Senha fraca. Use letras maiúsculas, minúsculas, números e símbolos.";
  if (m.includes("same password")) return "A nova senha deve ser diferente da senha anterior.";
  return msg;
}

function DefinirSenhaPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        setErrorMsg("Link expirado ou inválido. Solicite ao administrador que reenvie o convite.");
      }
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (password !== confirm) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setErrorMsg("Sessão expirada. Solicite um novo convite.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha definida com sucesso! Bem-vindo(a).");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setErrorMsg(traduzirErroSenha(err.message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <img src={logo} alt="Sublime" className="h-16 mx-auto mb-2" />
          <CardTitle className="text-2xl">Definir sua senha</CardTitle>
          <CardDescription>Crie uma senha para acessar o ACT Sublime</CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg && !sessionReady ? (
            <p className="text-sm text-destructive text-center">{errorMsg}</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting || !sessionReady}>
                {submitting ? "Aguarde…" : "Definir senha e entrar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
