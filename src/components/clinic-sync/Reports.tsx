import { useEffect, useMemo, useState } from "react";
import { supabase } from "./db";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import type { Child } from "./ChildBar";

const PERIODS = ["Última semana", "Último mês", "Bimestre", "Trimestre"];
const SECTIONS = [
  "Evolução das habilidades",
  "Observações da sessão",
  "Atividades realizadas",
  "Sugestões para casa",
  "Próximos objetivos",
  "Pontos de atenção",
];
const TONES = ["💚 Carinhoso", "📋 Técnico", "⚡ Curto e direto"];

function periodToDays(p: string) {
  if (p.includes("semana")) return 7;
  if (p.includes("mês")) return 30;
  if (p.includes("Bimestre")) return 60;
  return 90;
}

export function Reports({ child }: { child: Child }) {
  const [period, setPeriod] = useState("Último mês");
  const [tone, setTone] = useState(TONES[0]);
  const [sections, setSections] = useState(SECTIONS.slice(0, 2));
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - periodToDays(period));
    supabase.from("cs_sessions").select("*").eq("child_id", child.id)
      .gte("session_date", since.toISOString().slice(0, 10))
      .order("session_date", { ascending: false })
      .then(({ data }: { data: any[] | null }) => setSessions(data ?? []));
  }, [child.id, period]);

  const stats = useMemo(() => {
    const all = sessions.flatMap((s) => Object.values(s.ratings ?? {}) as number[]);
    const avg = all.length ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1) : "—";
    const areas = new Set(sessions.flatMap((s) => s.skills ?? []));
    return { sessions: sessions.length, areas: areas.size, avg };
  }, [sessions]);

  const skillProgress = useMemo(() => {
    const acc: Record<string, { sum: number; n: number }> = {};
    sessions.forEach((s) => {
      Object.entries(s.ratings ?? {}).forEach(([k, v]) => {
        if (!acc[k]) acc[k] = { sum: 0, n: 0 };
        acc[k].sum += Number(v); acc[k].n++;
      });
    });
    const labels: Record<string, string> = { com: "Comunicação", vis: "Contato visual", par: "Participação", reg: "Regulação" };
    return Object.entries(acc).map(([k, v]) => ({ label: labels[k] ?? k, avg: v.sum / v.n }));
  }, [sessions]);

  const toggleSection = (s: string) =>
    setSections((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const generate = async () => {
    setLoading(true); setText("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { childName: child.name, period, sections, tone, sessions },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setText((data as any).text || "");
    } catch (e: any) {
      toast({ title: "Falha ao gerar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const send = (kind: "wa" | "email" | "copy") => {
    if (!text) return;
    if (kind === "copy") { navigator.clipboard.writeText(text); toast({ title: "Copiado!" }); return; }
    if (kind === "wa") window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    if (kind === "email") window.location.href = `mailto:?subject=Relat%C3%B3rio%20${encodeURIComponent(child.name)}&body=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Sessões" value={stats.sessions} />
        <Stat label="Áreas" value={stats.areas} />
        <Stat label="Média" value={stats.avg} />
      </div>

      <div className="card-soft">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Progresso</h3>
        {skillProgress.length === 0 && <p className="text-sm text-muted-foreground">Sem avaliações no período.</p>}
        <div className="space-y-2">
          {skillProgress.map((s) => (
            <div key={s.label}>
              <div className="flex justify-between text-xs mb-1"><span>{s.label}</span><span>{s.avg.toFixed(1)}/5</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(s.avg / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-soft space-y-3">
        <div>
          <Label>Período</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <Label className="mb-1 block">Incluir</Label>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => {
              const on = sections.includes(s);
              return (
                <button key={s} type="button" onClick={() => toggleSection(s)}
                  className={`text-xs rounded-full px-3 py-1.5 border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{s}</button>
              );
            })}
          </div>
        </div>
        <div>
          <Label className="mb-1 block">Tom</Label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button key={t} type="button" onClick={() => setTone(t)}
                className={`text-xs rounded-full px-3 py-1.5 border transition ${tone === t ? "bg-secondary text-secondary-foreground border-secondary" : "bg-background border-border"}`}>{t}</button>
            ))}
          </div>
        </div>
        <Button className="w-full" onClick={generate} disabled={loading}>
          {loading ? "Gerando..." : "✨ Gerar relatório com IA"}
        </Button>
        {text && (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => send("wa")}>💬 WhatsApp</Button>
            <Button variant="outline" onClick={() => send("email")}>📧 E-mail</Button>
            <Button variant="outline" onClick={() => send("copy")}>📋 Copiar</Button>
          </div>
        )}
      </div>

      {text && (
        <div className="card-soft">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pré-visualização</h3>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="card-soft text-center !p-3">
    <div className="text-xl font-bold text-primary">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);
