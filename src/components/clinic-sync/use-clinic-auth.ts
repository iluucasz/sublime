// Adaptador de auth do módulo Clinic Sync.
// Compõe o useAuth do app principal (usuário, papéis, signOut) com a tabela
// cs_members (is_active, permissions, is_admin, role_label) e expõe a mesma
// interface que os componentes portados esperavam do antigo useAuth.
import { useEffect, useState } from "react";
import { useAuth as useMainAuth } from "@/hooks/use-auth";
import { supabase } from "./db";

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  edit_patients: false,
  delete_patients: false,
  edit_sessions: true,
  delete_sessions: false,
  view_reports: true,
  use_assistant: true,
  manage_team: false,
};

type ClinicProfile = {
  full_name: string;
  role_label: string;
  is_active: boolean;
  is_admin: boolean;
  permissions: Record<string, boolean>;
};

export function useClinicAuth() {
  const { user, loading: mainLoading, isRespTecnicoOrAdmin, signOut } = useMainAuth();
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    (async () => {
      const [{ data: base }, { data: member }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("cs_members").select("role_label,is_active,is_admin,permissions").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setProfile({
        full_name: base?.full_name ?? user.email?.split("@")[0] ?? "Usuário",
        role_label: member?.role_label ?? "Acompanhante Terapêutica (AT)",
        is_active: member?.is_active ?? true,
        is_admin: member?.is_admin ?? false,
        permissions: member?.permissions ?? {},
      });
      setLoadingProfile(false);
    })();
    return () => { active = false; };
  }, [user]);

  const isAdmin = isRespTecnicoOrAdmin || !!profile?.is_admin;
  const isActive = profile?.is_active !== false;
  const can = (key: string) =>
    isAdmin || (profile?.permissions?.[key] ?? DEFAULT_PERMISSIONS[key] ?? false);
  const canManageTeam = isAdmin || !!profile?.permissions?.manage_team;

  return {
    user,
    profile,
    loading: mainLoading || loadingProfile,
    isAdmin,
    isActive,
    can,
    canManageTeam,
    signOut,
  };
}
