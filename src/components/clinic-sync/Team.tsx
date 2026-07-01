import { useEffect, useState } from "react";
import { supabase } from "./db";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useClinicAuth } from "./use-clinic-auth";
import { Users, ShieldCheck, ShieldOff } from "lucide-react";

// Papéis de liderança do app principal que já concedem "admin" do módulo.
const LEADERSHIP = new Set(["diretoria", "responsavel_tecnico", "profissional_lideranca"]);

type Member = {
  id: string;
  full_name: string;
  role_label: string;
  is_active: boolean;
  is_admin: boolean;          // admin do módulo (flag em cs_members OU liderança)
  is_leadership: boolean;     // veio de papel global (não pode desmarcar aqui)
  permissions: Record<string, boolean>;
};

const PERMS: { key: string; label: string }[] = [
  { key: "edit_patients", label: "Editar pacientes" },
  { key: "delete_patients", label: "Excluir pacientes" },
  { key: "edit_sessions", label: "Editar sessões" },
  { key: "delete_sessions", label: "Excluir sessões" },
  { key: "view_reports", label: "Ver relatórios" },
  { key: "use_assistant", label: "Usar Assistente IA" },
  { key: "manage_team", label: "Gerenciar equipe" },
];

export function Team() {
  const { canManageTeam } = useClinicAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: memberRows }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("cs_members").select("user_id,role_label,is_active,is_admin,permissions"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const memberMap = new Map((memberRows ?? []).map((m: any) => [m.user_id, m]));
    const leaderSet = new Set(
      (roles ?? []).filter((r: any) => LEADERSHIP.has(r.role)).map((r: any) => r.user_id)
    );
    setMembers((profiles ?? []).map((p: any) => {
      const m: any = memberMap.get(p.id);
      const isLeadership = leaderSet.has(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        role_label: m?.role_label ?? "—",
        is_active: m?.is_active ?? true,
        is_admin: isLeadership || !!m?.is_admin,
        is_leadership: isLeadership,
        permissions: m?.permissions ?? {},
      };
    }));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (!canManageTeam) {
    return <div className="card-soft text-center text-sm text-muted-foreground py-8">Acesso restrito à Diretoria e Supervisores ABA.</div>;
  }

  // Grava o estado completo do membro em cs_members (upsert por user_id).
  const persist = async (m: Member, patch: Partial<Member>) => {
    const next = { ...m, ...patch };
    const { error } = await supabase.from("cs_members").upsert({
      user_id: m.id,
      role_label: next.role_label === "—" ? "Acompanhante Terapêutica (AT)" : next.role_label,
      is_active: next.is_active,
      is_admin: next.is_leadership ? false : next.is_admin, // liderança já é admin via papel global
      permissions: next.permissions,
    }, { onConflict: "user_id" });
    return error;
  };

  const toggleActive = async (m: Member) => {
    const error = await persist(m, { is_active: !m.is_active });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: m.is_active ? "Colaborador inativado" : "Colaborador ativado" });
    load();
  };

  const togglePerm = async (m: Member, key: string) => {
    const next = { ...m.permissions, [key]: !m.permissions[key] };
    const error = await persist(m, { permissions: next });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setMembers((arr) => arr.map((x) => x.id === m.id ? { ...x, permissions: next } : x));
  };

  const toggleAdmin = async (m: Member) => {
    if (m.is_leadership) {
      return toast({ title: "Este colaborador já é admin por cargo (Diretoria/Supervisão)." });
    }
    const error = await persist(m, { is_admin: !m.is_admin });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Permissão atualizada" });
    load();
  };

  if (loading) return <div className="text-center text-sm text-muted-foreground py-8">Carregando equipe...</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">Equipe ({members.length})</h2>
      </div>
      {members.map((m) => {
        const open = openId === m.id;
        return (
          <div key={m.id} className="card-soft">
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => setOpenId(open ? null : m.id)} className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.full_name}</span>
                  {m.is_admin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">ADMIN</span>}
                  {!m.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">INATIVO</span>}
                </div>
                <div className="text-xs text-muted-foreground">{m.role_label}</div>
              </button>
              <Button size="sm" variant={m.is_active ? "outline" : "default"} onClick={() => toggleActive(m)}>
                {m.is_active ? <><ShieldOff className="w-3.5 h-3.5 mr-1" />Inativar</> : <><ShieldCheck className="w-3.5 h-3.5 mr-1" />Ativar</>}
              </Button>
            </div>
            {open && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Acesso administrativo total</Label>
                  <Switch checked={m.is_admin} disabled={m.is_leadership} onCheckedChange={() => toggleAdmin(m)} />
                </div>
                <div className="text-xs font-medium text-muted-foreground pt-1">Permissões de módulos</div>
                {PERMS.map((p) => (
                  <div key={p.key} className="flex items-center justify-between">
                    <Label className="text-sm font-normal">{p.label}</Label>
                    <Switch
                      checked={m.is_admin || !!m.permissions[p.key]}
                      disabled={m.is_admin}
                      onCheckedChange={() => togglePerm(m, p.key)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
