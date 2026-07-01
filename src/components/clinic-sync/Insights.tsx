import { useEffect, useMemo, useState } from "react";
import { supabase } from "./db";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp, Users, Activity } from "lucide-react";

type Child = { id: string; name: string; emoji: string | null };
type Sess = {
  id: string; child_id: string; session_date: string; created_at: string;
  professional_name: string; professional_role: string | null;
  mood: string | null; skills: string[] | null; ratings: any;
  observations: string | null;
};

const PERIODS = [
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 60 dias", days: 60 },
  { label: "Últimos 90 dias", days: 90 },
  { label: "Últimos 180 dias", days: 180 },
];

const RATING_LABELS: Record<string, string> = {
  com: "Comunicação",
  vis: "Contato visual",
  par: "Participação",
  reg: "Regulação",
};

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "#82ca9d"];

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function Insights() {
  const [period, setPeriod] = useState(PERIODS[0]);
  const [children, setChildren] = useState<Child[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<string | "all">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - period.days);
      const [{ data: ch }, { data: ss }] = await Promise.all([
        supabase.from("cs_children").select("id, name, emoji"),
        supabase.from("cs_sessions").select("*").gte("session_date", since.toISOString().slice(0, 10)),
      ]);
      setChildren((ch ?? []) as Child[]);
      setSessions((ss ?? []) as Sess[]);
      setLoading(false);
    })();
  }, [period]);

  // Atendimentos por criança
  const sessionsPerChild = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((s) => map.set(s.child_id, (map.get(s.child_id) ?? 0) + 1));
    return children.map((c) => ({
      name: `${c.emoji ?? "👦"} ${c.name.split(" ")[0]}`,
      id: c.id,
      total: map.get(c.id) ?? 0,
    })).sort((a, b) => b.total - a.total);
  }, [sessions, children]);

  // Distribuição por especialidade
  const byRole = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      const r = s.professional_role ?? "Não informado";
      map.set(r, (map.get(r) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [sessions]);

  // Evolução média (geral ou criança selecionada)
  const evolution = useMemo(() => {
    const filtered = selectedChild === "all" ? sessions : sessions.filter((s) => s.child_id === selectedChild);
    const byWeek = new Map<string, { sums: Record<string, number>; counts: Record<string, number> }>();
    filtered.forEach((s) => {
      const d = new Date(s.session_date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (!byWeek.has(key)) byWeek.set(key, { sums: {}, counts: {} });
      const slot = byWeek.get(key)!;
      Object.entries(s.ratings ?? {}).forEach(([k, v]) => {
        slot.sums[k] = (slot.sums[k] ?? 0) + Number(v);
        slot.counts[k] = (slot.counts[k] ?? 0) + 1;
      });
    });
    const sortedKeys = Array.from(byWeek.keys()).sort();
    return sortedKeys.map((key) => {
      const { sums, counts } = byWeek.get(key)!;
      const row: any = { semana: new Date(key).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
      Object.keys(RATING_LABELS).forEach((k) => {
        if (counts[k]) row[RATING_LABELS[k]] = +(sums[k] / counts[k]).toFixed(2);
      });
      return row;
    });
  }, [sessions, selectedChild]);

  // Ranking de ganhos/perdas — compara primeira metade × segunda metade do período
  const progress = useMemo(() => {
    const half = new Date();
    half.setDate(half.getDate() - period.days / 2);
    return children.map((c) => {
      const cs = sessions.filter((s) => s.child_id === c.id);
      const before = cs.filter((s) => new Date(s.session_date) < half);
      const after = cs.filter((s) => new Date(s.session_date) >= half);
      const allRatings = (arr: Sess[]) => arr.flatMap((s) => Object.values(s.ratings ?? {}) as number[]);
      const a = avg(allRatings(before));
      const b = avg(allRatings(after));
      return {
        id: c.id,
        name: `${c.emoji ?? "👦"} ${c.name}`,
        before: +a.toFixed(2),
        after: +b.toFixed(2),
        delta: +(b - a).toFixed(2),
        sessionsTotal: cs.length,
      };
    }).filter((p) => p.before > 0 || p.after > 0);
  }, [children, sessions, period]);

  // Alertas para estudo de caso
  const alerts = useMemo(() => {
    const cutoff14 = new Date(); cutoff14.setDate(cutoff14.getDate() - 14);
    return children.map((c) => {
      const cs = sessions.filter((s) => s.child_id === c.id);
      const last = cs.sort((a, b) => b.session_date.localeCompare(a.session_date))[0];
      const allRatings = cs.flatMap((s) => Object.values(s.ratings ?? {}) as number[]);
      const mean = avg(allRatings);
      const lowMoodCount = cs.filter((s) => /Irritado|Ansioso|Agitado|Cansado/.test(s.mood ?? "")).length;
      const lowMoodRatio = cs.length ? lowMoodCount / cs.length : 0;
      const noRecent = !last || new Date(last.session_date) < cutoff14;
      const reasons: string[] = [];
      if (noRecent) reasons.push("Sem registro nos últimos 14 dias");
      if (cs.length > 0 && mean > 0 && mean < 2.5) reasons.push(`Média baixa (${mean.toFixed(1)}/5)`);
      if (lowMoodRatio >= 0.5 && cs.length >= 2) reasons.push(`${Math.round(lowMoodRatio * 100)}% das sessões com humor desafiador`);
      const prog = progress.find((p) => p.id === c.id);
      if (prog && prog.before > 0 && prog.after > 0 && prog.delta <= -0.5) reasons.push(`Queda de desempenho (${prog.delta})`);
      return { child: c, reasons, sessionsTotal: cs.length };
    }).filter((a) => a.reasons.length > 0);
  }, [children, sessions, progress]);

  const totalSessions = sessions.length;
  const activeChildren = new Set(sessions.map((s) => s.child_id)).size;
  const activeProfs = new Set(sessions.map((s) => s.professional_name)).size;

  if (loading) return <div className="p-6 text-center text-muted-foreground">Carregando indicadores...</div>;

  return (
    <div className="space-y-4">
      <div className="card-soft flex items-center gap-2">
        <Label className="m-0">Período:</Label>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm flex-1"
          value={period.label}
          onChange={(e) => setPeriod(PERIODS.find((p) => p.label === e.target.value)!)}
        >
          {PERIODS.map((p) => <option key={p.label}>{p.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<Activity className="w-4 h-4" />} label="Atendimentos" value={totalSessions} />
        <Stat icon={<Users className="w-4 h-4" />} label="Crianças ativas" value={activeChildren} />
        <Stat icon={<TrendingUp className="w-4 h-4" />} label="Profissionais" value={activeProfs} />
      </div>

      {alerts.length > 0 && (
        <div className="card-soft border-l-4 border-destructive">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Atenção — sugeridas para estudo de caso ({alerts.length})
          </h3>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.child.id} className="rounded-lg bg-destructive/5 border border-destructive/20 p-2">
                <div className="text-sm font-medium">{a.child.emoji} {a.child.name}</div>
                <ul className="text-xs text-muted-foreground list-disc pl-5 mt-1">
                  {a.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                <div className="text-[11px] text-muted-foreground mt-1">{a.sessionsTotal} sessão(ões) no período</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card-soft">
        <h3 className="text-sm font-semibold mb-2">Atendimentos por criança</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sessionsPerChild}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-soft">
        <h3 className="text-sm font-semibold mb-2">Distribuição por especialidade</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byRole} dataKey="value" nameKey="name" outerRadius={80} label={{ fontSize: 10 }}>
                {byRole.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-soft">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Evolução das habilidades</h3>
          <select
            className="h-8 text-xs rounded-md border border-input bg-background px-2"
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value as any)}
          >
            <option value="all">Média geral</option>
            {children.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {Object.values(RATING_LABELS).map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-soft">
        <h3 className="text-sm font-semibold mb-2">Ranking de progresso (1ª × 2ª metade)</h3>
        {progress.length === 0 && <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>}
        <ul className="space-y-2">
          {progress.sort((a, b) => b.delta - a.delta).map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span>{p.name}</span>
              <span className={`flex items-center gap-1 text-xs font-semibold ${p.delta > 0 ? "text-emerald-600" : p.delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {p.delta > 0 ? <TrendingUp className="w-3 h-3" /> : p.delta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                {p.before.toFixed(1)} → {p.after.toFixed(1)} ({p.delta > 0 ? "+" : ""}{p.delta})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) => (
  <div className="card-soft text-center !p-3">
    <div className="flex items-center justify-center gap-1 text-primary">{icon}<span className="text-xl font-bold">{value}</span></div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
  </div>
);
