import { useState } from "react";
import { useClinicAuth } from "./use-clinic-auth";
import { ChildBar, useChildren } from "./ChildBar";
import { SessionForm } from "./SessionForm";
import { Diary } from "./Diary";
import { Reports } from "./Reports";
import { Assistant } from "./Assistant";
import { Team } from "./Team";
import { Insights } from "./Insights";
import { FileText, BookOpen, BarChart3, Sparkles, Users, LineChart } from "lucide-react";

export function ClinicSyncModule() {
  const { user, loading, canManageTeam, isActive, can } = useClinicAuth();
  const TABS = [
    { id: "reg", label: "Registro", icon: FileText, show: true },
    { id: "diary", label: "Diário", icon: BookOpen, show: true },
    { id: "report", label: "Relatório", icon: BarChart3, show: can("view_reports") },
    { id: "insights", label: "Indicadores", icon: LineChart, show: can("view_reports") },
    { id: "ia", label: "Subliminho", icon: Sparkles, show: can("use_assistant") },
    { id: "team", label: "Equipe", icon: Users, show: canManageTeam },
  ].filter((t) => t.show);
  const [tab, setTab] = useState<string>("reg");
  const { items, activeId, setActiveId, reload } = useChildren();
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (!user) return null;

  const activeChild = items.find((c) => c.id === activeId) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
        <ChildBar children={items} activeId={activeId} onSelect={setActiveId} onChanged={reload} />

        <nav className="flex flex-wrap gap-1 p-2 border-t">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      <main className="space-y-4">
        {!isActive && (
          <div className="card-soft text-center py-6 text-sm text-destructive border border-destructive/30">
            Sua conta está inativa. Procure a Diretoria.
          </div>
        )}
        {tab === "team" && <Team />}
        {tab === "insights" && <Insights />}
        {tab !== "team" && tab !== "insights" && tab !== "ia" && !activeChild && (
          <div className="card-soft text-center py-10 text-sm text-muted-foreground">
            <p className="mb-2">Nenhuma criança cadastrada.</p>
            <p className="text-xs">Toque no <b>+</b> acima para adicionar a primeira (admin).</p>
          </div>
        )}
        {activeChild && tab === "reg" && isActive && (
          <SessionForm key={refreshKey} child={activeChild} onSaved={() => setRefreshKey((k) => k + 1)} />
        )}
        {activeChild && tab === "diary" && <Diary key={refreshKey + ":" + activeChild.id} childId={activeChild.id} />}
        {activeChild && tab === "report" && <Reports child={activeChild} />}
        {tab === "ia" && <Assistant />}
      </main>
    </div>
  );
}
