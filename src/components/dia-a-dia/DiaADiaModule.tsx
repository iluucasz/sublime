import { useMemo, useState, type ComponentType } from "react";
import { useDiaAuth } from "./use-dia-auth";
import { DiaNavContext, type DiaView, type DiaParams } from "./DiaNav";
import { cn } from "@/lib/utils";
import {
  Home, Calendar, FileText, Bell, Users, Upload,
  LayoutDashboard, BookOpen, Headphones,
} from "lucide-react";
import AdminHome from "./pages/AdminHome";
import ParentHome from "./pages/ParentHome";
import Pacientes from "./pages/Pacientes";
import Profissionais from "./pages/Profissionais";
import GradeAdmin from "./pages/GradeAdmin";
import Documentos from "./pages/Documentos";
import AvisosAdmin from "./pages/AvisosAdmin";
import Importar from "./pages/Importar";
import Grade from "./pages/Grade";
import Avisos from "./pages/Avisos";
import Blog from "./pages/Blog";
import Podcast from "./pages/Podcast";

type NavItem = { view: DiaView; label: string; icon: ComponentType<any>; show: boolean };

const REGISTRY: Partial<Record<DiaView, ComponentType>> = {
  // admin
  "admin-home": AdminHome,
  "pacientes": Pacientes,
  "profissionais": Profissionais,
  "grade-admin": GradeAdmin,
  "documentos-admin": Documentos,
  "avisos-admin": AvisosAdmin,
  "importar": Importar,
  // pais
  "parent-home": ParentHome,
  "grade": Grade,
  "documentos": Documentos,
  "avisos": Avisos,
  "blog": Blog,
  "podcast": Podcast,
};

export function DiaADiaModule() {
  const auth = useDiaAuth();
  const [view, setView] = useState<DiaView | null>(null);
  const [params, setParams] = useState<DiaParams>({});

  const go = (v: DiaView, p: DiaParams = {}) => { setView(v); setParams(p); };

  const nav: NavItem[] = useMemo(() => {
    if (auth.role === "admin") {
      const items: NavItem[] = [
        { view: "admin-home", label: "Painel", icon: LayoutDashboard, show: true },
        { view: "pacientes", label: "Pacientes", icon: Users, show: auth.canViewPatients },
        { view: "grade-admin", label: "Grade", icon: Calendar, show: auth.canViewPatients },
        { view: "profissionais", label: "Profissionais", icon: Users, show: auth.isAdmin },
        { view: "avisos-admin", label: "Avisos", icon: Bell, show: auth.canAccessAvisos },
        { view: "blog", label: "Blog", icon: BookOpen, show: auth.canBlog },
        { view: "podcast", label: "Podcast", icon: Headphones, show: auth.canPodcast },
        { view: "importar", label: "Importar", icon: Upload, show: auth.isAdmin },
      ];
      return items.filter((i) => i.show);
    }
    if (auth.role === "parent") {
      const items: NavItem[] = [
        { view: "parent-home", label: "Início", icon: Home, show: true },
        { view: "grade", label: "Grade", icon: Calendar, show: true },
        { view: "documentos", label: "Documentos", icon: FileText, show: true },
        { view: "avisos", label: "Avisos", icon: Bell, show: true },
        { view: "blog", label: "Blog", icon: BookOpen, show: true },
        { view: "podcast", label: "Podcast", icon: Headphones, show: true },
      ];
      return items;
    }
    return [];
  }, [auth.role, auth.canViewPatients, auth.isAdmin, auth.canAccessAvisos, auth.canBlog, auth.canPodcast]);

  const current: DiaView | null = view ?? (auth.role === "admin" ? "admin-home" : auth.role === "parent" ? "parent-home" : null);

  if (auth.loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!auth.role) {
    return <div className="card-soft text-center text-sm text-muted-foreground py-10">Você não tem acesso ao módulo Dia a Dia. Fale com a diretoria.</div>;
  }

  const Active = current ? REGISTRY[current] : undefined;

  return (
    <DiaNavContext.Provider value={{ view: current!, params, go }}>
      <div className="flex flex-col md:flex-row gap-4">
        <aside className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto rounded-xl border bg-card p-2">
            {nav.map((it) => {
              const on = current === it.view;
              return (
                <button
                  key={it.view}
                  onClick={() => go(it.view)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors",
                    on ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground",
                  )}
                >
                  <it.icon className="h-4 w-4 shrink-0" /> {it.label}
                </button>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          {Active ? (
            <Active />
          ) : (
            <div className="card-soft text-center text-sm text-muted-foreground py-12">
              Tela em portação — será disponibilizada em breve.
            </div>
          )}
        </main>
      </div>
    </DiaNavContext.Provider>
  );
}
