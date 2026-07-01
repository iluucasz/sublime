import { useEffect, useState } from "react";
import { supabase } from "../db";
import { useDiaNav } from "../DiaNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface TimelineItem {
  id: string;
  kind: "notice" | "blog" | "podcast";
  category?: string;
  title: string;
  message: string;
  created_at: string;
  read_at?: string | null;
  patient_name?: string | null;
  audio_url?: string;
}

const cat: Record<string, { label: string; cls: string; dot: string }> = {
  billing: { label: "Faturamento", cls: "bg-sublime-yellow/40 text-sublime-navy", dot: "bg-sublime-yellow" },
  reception: { label: "Recepção", cls: "bg-sublime-blue/30 text-sublime-navy", dot: "bg-sublime-blue" },
  clinical: { label: "Clínico", cls: "bg-sublime-pink/30 text-sublime-navy", dot: "bg-sublime-pink" },
  event: { label: "Evento Sublime", cls: "bg-primary/10 text-sublime-navy", dot: "bg-primary" },
  customer_success: { label: "Sucesso ao Cliente", cls: "bg-green-100 text-green-800", dot: "bg-green-500" },
  blog: { label: "Blog", cls: "bg-sublime-blue/20 text-sublime-navy", dot: "bg-sublime-blue" },
  podcast: { label: "Podcast", cls: "bg-sublime-pink/20 text-sublime-navy", dot: "bg-sublime-pink" },
};

const CATEGORIES = ["all", "billing", "reception", "clinical", "event", "customer_success", "blog", "podcast"];

export default function Avisos() {
  const { params } = useDiaNav();
  const category = params.category;
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [filter, setFilter] = useState<string>(category ?? "all");

  const load = async () => {
    const [n, b, p] = await Promise.all([
      supabase.from("dd_notices").select("*, dd_patients(child_name)").order("created_at", { ascending: false }),
      supabase.from("dd_blog_posts").select("id,title,content,created_at").order("created_at", { ascending: false }),
      supabase.from("dd_podcast_episodes").select("id,title,description,audio_path,created_at").order("created_at", { ascending: false }),
    ]);
    const list: TimelineItem[] = [
      ...((n.data as any[]) ?? []).map((x) => ({
        id: x.id, kind: "notice" as const, category: x.category, title: x.title, message: x.message,
        created_at: x.created_at, read_at: x.read_at, patient_name: x.dd_patients?.child_name ?? null,
      })),
      ...((b.data as any[]) ?? []).map((x) => ({
        id: x.id, kind: "blog" as const, category: "blog", title: x.title, message: x.content, created_at: x.created_at,
      })),
      ...((p.data as any[]) ?? []).map((x) => ({
        id: x.id, kind: "podcast" as const, category: "podcast", title: x.title, message: x.description ?? "",
        created_at: x.created_at,
        audio_url: supabase.storage.from("podcasts").getPublicUrl(x.audio_path).data.publicUrl,
      })),
    ];
    list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setItems(list);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (category) setFilter(category); }, [category]);

  const markRead = async (id: string) => {
    await supabase.from("dd_notices").update({ read_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-sublime-navy">Linha do tempo</h1>
        <p className="text-sm text-muted-foreground">Todos os comunicados, posts e episódios</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={filter === c ? "default" : "outline"}
            className="rounded-full whitespace-nowrap"
            onClick={() => setFilter(c)}
          >
            {c === "all" ? "Todos" : cat[c]?.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nada por aqui.
        </CardContent></Card>
      ) : (
        <div className="relative pl-6 space-y-4 border-l-2 border-border ml-2">
          {filtered.map((n) => {
            const c = cat[n.category ?? ""];
            return (
              <div key={`${n.kind}-${n.id}`} className="relative">
                <span className={`absolute -left-[31px] top-3 h-4 w-4 rounded-full ring-4 ring-background ${c?.dot ?? "bg-muted"}`} />
                <Card className={n.kind === "notice" && !n.read_at ? "border-l-4 border-l-sublime-pink shadow-sm" : "shadow-sm"}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={c?.cls}>{c?.label}</Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sublime-navy">{n.title}</h3>
                    {n.message && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{n.message}</p>}
                    {n.audio_url && <audio controls preload="none" src={n.audio_url} className="w-full" />}
                    {n.kind === "notice" && (
                      <p className="text-xs text-muted-foreground">
                        {n.patient_name ? `Para: ${n.patient_name}` : "Aviso geral"}
                      </p>
                    )}
                    {n.kind === "notice" && !n.read_at && (
                      <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Marcar como lido</Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
