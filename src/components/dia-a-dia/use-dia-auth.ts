// Adaptador de auth do módulo Dia a Dia.
// Compõe o useAuth do app principal (papéis vindos de user_roles) com dd_members
// (approved) e recria os mesmos flags de permissão que o AuthContext original expunha.
// "admin" do módulo = diretoria/operador (igual à função dd_is_admin no banco).
import { useEffect, useState } from "react";
import { useAuth as useMainAuth } from "@/hooks/use-auth";
import { supabase } from "./db";

// Papéis do principal considerados "equipe" (lado admin do módulo).
const STAFF = new Set(["diretoria", "operador", "reception", "customer_success", "avisos"]);

export type DiaRole = "admin" | "parent" | null;

export function useDiaAuth() {
  const main = useMainAuth();
  const roles = main.roles as unknown as string[];
  const [isApproved, setIsApproved] = useState(true);
  const [loadingApproval, setLoadingApproval] = useState(true);

  useEffect(() => {
    let active = true;
    if (!main.user) { setIsApproved(true); setLoadingApproval(false); return; }
    setLoadingApproval(true);
    supabase.from("dd_members").select("approved").eq("user_id", main.user.id).maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!active) return;
        setIsApproved(data?.approved ?? true);
        setLoadingApproval(false);
      });
    return () => { active = false; };
  }, [main.user]);

  const has = (r: string) => roles.includes(r);
  const isAdmin = has("diretoria") || has("operador");
  const isReception = has("reception");
  const isCustomerSuccess = has("customer_success");
  const hasStaffRole = roles.some((r) => STAFF.has(r));
  const role: DiaRole = hasStaffRole ? "admin" : has("parent") ? "parent" : null;

  return {
    user: main.user,
    loading: main.loading || loadingApproval,
    signOut: main.signOut,
    roles,
    role,
    isAdmin,
    isReception,
    isCustomerSuccess,
    isApproved,
    canAccessAvisos: isAdmin || isReception || isCustomerSuccess || has("avisos"),
    canSendAvisos: isAdmin || isCustomerSuccess || has("avisos"),
    canApprove: isAdmin || isCustomerSuccess,
    canViewApprovals: isAdmin || isCustomerSuccess || isReception,
    canViewPatients: isAdmin || isReception || isCustomerSuccess,
    canEditPatients: isAdmin,
    canManageUsers: isAdmin || isCustomerSuccess,
    canBlog: isAdmin || has("blog_author"),
    canPodcast: isAdmin || has("podcast_author"),
  };
}
