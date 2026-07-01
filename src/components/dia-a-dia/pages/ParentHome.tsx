import { useEffect, useState } from "react";
import { supabase } from "../db";
import { useDiaAuth } from "../use-dia-auth";
import { useDiaNav } from "../DiaNav";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, FileText, Bell, ChevronRight, MessageCircle, BookOpen, Headphones } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const WHATSAPP_URL = "https://wa.me/5521986680771";

interface Patient { id: string; child_name: string; admission_date: string | null; medical_request_date: string | null; }
interface TimelineItem { id: string; kind: "notice" | "blog" | "podcast"; title: string; created_at: string; }

const kindLabel: Record<TimelineItem["kind"], string> = {
  notice: "Aviso", blog: "Blog", podcast: "Podcast",
};
const kindIcon = { notice: Bell, blog: BookOpen, podcast: Headphones } as const;
const kindView = { notice: "avisos", blog: "blog", podcast: "podcast" } as const;

export default function ParentHome() {
  const { user } = useDiaAuth();
  const { go } = useDiaNav();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [recent, setRecent] = useState<TimelineItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("dd_patients").select("id,child_name,admission_date,medical_request_date").then(({ data }: any) => setPatients(data ?? []));
    supabase.from("dd_notices").select("id", { count: "exact", head: true }).is("read_at", null).then(({ count }: any) => setUnreadCount(count ?? 0));

    Promise.all([
      supabase.from("dd_notices").select("id,title,created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("dd_blog_posts").select("id,title,created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("dd_podcast_episodes").select("id,title,created_at").order("created_at", { ascending: false }).limit(5),
    ]).then(([n, b, p]: any[]) => {
      const items: TimelineItem[] = [
        ...((n.data as any[]) ?? []).map((x) => ({ id: x.id, kind: "notice" as const, title: x.title, created_at: x.created_at })),
        ...((b.data as any[]) ?? []).map((x) => ({ id: x.id, kind: "blog" as const, title: x.title, created_at: x.created_at })),
        ...((p.data as any[]) ?? []).map((x) => ({ id: x.id, kind: "podcast" as const, title: x.title, created_at: x.created_at })),
      ];
      items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      setRecent(items.slice(0, 5));
    });
  }, [user]);

  const quick = [
    { view: "grade" as const, label: "Grade", icon: Calendar, color: "bg-sublime-blue/20 text-sublime-blue" },
    { view: "documentos" as const, params: { type: "therapy_plan" }, label: "Planejamento", icon: FileText, color: "bg-sublime-navy/10 text-sublime-navy" },
    { view: "documentos" as const, params: { type: "semester_report" }, label: "Relatórios", icon: FileText, color: "bg-sublime-yellow/30 text-sublime-navy" },
    { view: "avisos" as const, label: "Avisos", icon: Bell, color: "bg-sublime-pink/30 text-sublime-navy", badge: unreadCount },
    { view: "blog" as const, label: "Blog", icon: BookOpen, color: "bg-sublime-blue/20 text-sublime-blue" },
    { view: "podcast" as const, label: "Podcast", icon: Headphones, color: "bg-sublime-pink/30 text-sublime-navy" },
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-sublime-navy">Olá! 👋</h1>
        <p className="text-sm text-muted-foreground">Acompanhe o dia a dia na Sublime</p>
      </div>

      {patients.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          Nenhum paciente vinculado ainda. Aguarde a clínica liberar seu acesso.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {patients.map((p) => {
            const isExpiring = p.medical_request_date && Math.ceil(Math.abs(new Date().getTime() - new Date(p.medical_request_date).getTime()) / (1000 * 60 * 60 * 24)) >= 150;
            return (
              <Card key={p.id} className={`border-l-4 ${isExpiring ? 'border-l-red-500 bg-red-50' : 'border-l-sublime-blue'}`}>
                <CardContent className="p-4">
                  <p className={`font-bold ${isExpiring ? 'text-red-700' : 'text-sublime-navy'}`}>{p.child_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Admissão: {p.admission_date ? new Date(p.admission_date).toLocaleDateString("pt-BR") : "—"}
                  </p>
                  {isExpiring && (
                    <p className="text-xs font-semibold text-red-600 mt-2">⚠️ Pedido Médico vencendo. Providencie novo laudo.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Atalhos</h2>
        <div className="grid grid-cols-3 gap-3">
          {quick.map((q) => (
            <button key={q.label} onClick={() => go(q.view, (q as any).params)} className="flex flex-col items-center gap-2 group">
              <div className={`relative h-14 w-14 rounded-2xl flex items-center justify-center ${q.color} group-active:scale-95 transition-transform`}>
                <q.icon className="h-6 w-6" />
                {q.badge ? (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{q.badge}</span>
                ) : null}
              </div>
              <span className="text-xs text-center text-sublime-navy font-medium leading-tight">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sticky top-16 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur">
        <Button
          asChild
          className="w-full bg-green-600 hover:bg-green-700 text-white h-12 rounded-2xl shadow-md"
        >
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-5 w-5 mr-2" /> Fale Conosco
          </a>
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Linha do tempo</h2>
          <button onClick={() => go("avisos")} className="text-xs text-primary font-medium flex items-center">Ver tudo <ChevronRight className="h-3 w-3" /></button>
        </div>
        {recent.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nada por aqui ainda.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {recent.map((n) => {
              const Icon = kindIcon[n.kind];
              return (
                <button key={`${n.kind}-${n.id}`} onClick={() => go(kindView[n.kind])} className="w-full text-left">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 flex items-start gap-3">
                      <Icon className="h-4 w-4 text-sublime-pink mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px]">{kindLabel[n.kind]}</Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <p className="text-sm font-medium text-sublime-navy truncate">{n.title}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
