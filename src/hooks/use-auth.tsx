import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Role =
  | "diretoria"
  | "responsavel_tecnico"
  | "profissional_lideranca"
  | "profissional"
  | "operador"
  | "rt";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  hasRole: (r: Role) => boolean;
  isAdmin: boolean;
  isRespTecnicoOrAdmin: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        router.navigate({ to: "/definir-senha" });
        return;
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const newUserId = s?.user?.id ?? null;
      const identityChanged = newUserId !== currentUserIdRef.current;
      currentUserIdRef.current = newUserId;

      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        // Only reload roles when the actual user changes. Repeated SIGNED_IN/USER_UPDATED
        // events for the same session must not invalidate every query, otherwise the app
        // keeps refetching report data in a loop.
        if (identityChanged) {
          setTimeout(() => {
            void loadRoles(s.user.id).finally(() => router.invalidate());
          }, 0);
        }
      } else {
        setRoles([]);
        router.invalidate();
        qc.clear();
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      currentUserIdRef.current = data.session?.user?.id ?? null;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadRoles(data.session.user.id);
      else setRoles([]);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRoles(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as Role));
  }

  const value: AuthCtx = {
    user,
    session,
    roles,
    loading,
    hasRole: (r) => roles.includes(r),
    isAdmin: roles.includes("diretoria") || roles.includes("operador"),
    isRespTecnicoOrAdmin:
      roles.includes("diretoria") ||
      roles.includes("responsavel_tecnico") ||
      roles.includes("profissional_lideranca"),
    signOut: async () => {
      await supabase.auth.signOut();
      router.navigate({ to: "/login" });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
