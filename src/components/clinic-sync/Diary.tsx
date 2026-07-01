import { useEffect, useState } from "react";
import { supabase } from "./db";
import { Star } from "lucide-react";

type Sess = {
  id: string;
  session_date: string;
  professional_name: string;
  professional_role: string | null;
  mood: string | null;
  mood_color: string | null;
  skills: string[] | null;
  ratings: any;
  activities: string | null;
  observations: string | null;
  message_to_parents: string | null;
};

export function Diary({ childId }: { childId: string }) {
  const [items, setItems] = useState<Sess[]>([]);
  const [filter, setFilter] = useState("");

  const reload = async () => {
    const { data } = await supabase.from("cs_sessions").select("*").eq("child_id", childId).order("session_date", { ascending: false }).order("created_at", { ascending: false });
    setItems((data ?? []) as Sess[]);
  };
  useEffect(() => { reload(); }, [childId]);

  const profs = Array.from(new Set(items.map((e) => e.professional_name)));
  const list = filter ? items.filter((e) => e.professional_name === filter) : items;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registros</h2>
        <select className="h-8 text-xs rounded-md border border-input bg-background px-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos os profissionais</option>
          {profs.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      {list.length === 0 && (
        <div className="card-soft text-center text-sm text-muted-foreground py-8">
          Nenhum registro ainda.
        </div>
      )}
      {list.map((e) => (
        <article key={e.id} className="card-soft space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{new Date(e.session_date).toLocaleDateString("pt-BR")}</span>
            <span className="chip bg-accent text-accent-foreground">{e.professional_name}</span>
          </div>
          {e.mood && <div className="text-sm font-medium">Humor: {e.mood}</div>}
          {e.skills && e.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {e.skills.map((s) => <span key={s} className="chip bg-primary/10 text-primary">{s}</span>)}
            </div>
          )}
          {e.ratings && Object.keys(e.ratings).length > 0 && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {Object.entries(e.ratings as Record<string, number>).map(([k, v]) => (
                <span key={k} className="flex items-center gap-0.5">
                  {k}: <Star className="w-3 h-3 fill-accent-yellow text-accent-yellow" /> {v}
                </span>
              ))}
            </div>
          )}
          {e.activities && <p className="text-sm"><b>Atividades:</b> {e.activities}</p>}
          {e.observations && <p className="text-sm">{e.observations}</p>}
          {e.message_to_parents && (
            <div className="rounded-md bg-accent-yellow/15 p-2 text-sm">
              💬 {e.message_to_parents}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
