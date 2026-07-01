import { useState } from "react";
import { supabase } from "./db";
import { useClinicAuth } from "./use-clinic-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Star, Camera, X } from "lucide-react";
import type { Child } from "./ChildBar";

const MOODS = [
  { v: "Calmo", icon: "😊", c: "good" },
  { v: "Alegre", icon: "😄", c: "good" },
  { v: "Agitado", icon: "😤", c: "warn" },
  { v: "Ansioso", icon: "😟", c: "warn" },
  { v: "Irritado", icon: "😡", c: "bad" },
  { v: "Cansado", icon: "😴", c: "blue" },
  { v: "Focado", icon: "🎯", c: "purple" },
  { v: "Feliz", icon: "🥰", c: "good" },
] as const;

const SKILLS = [
  "Comunicação", "Interação social", "Regulação emocional", "Habilidades motoras",
  "Atenção e foco", "Rotina e autonomia", "Jogo simbólico", "Linguagem receptiva",
  "Imitação", "Senso do corpo", "Habilidades acadêmicas", "Autocuidado",
];

const RATING_KEYS: { key: "com" | "vis" | "par" | "reg"; label: string }[] = [
  { key: "com", label: "Comunicação verbal" },
  { key: "vis", label: "Contato visual" },
  { key: "par", label: "Participação" },
  { key: "reg", label: "Regulação emocional" },
];

const moodClass: Record<string, string> = {
  good: "bg-[hsl(var(--mood-good-bg))] text-[hsl(var(--mood-good-fg))] border-[hsl(var(--mood-good-fg)/0.2)]",
  warn: "bg-[hsl(var(--mood-warn-bg))] text-[hsl(var(--mood-warn-fg))] border-[hsl(var(--mood-warn-fg)/0.2)]",
  bad: "bg-[hsl(var(--mood-bad-bg))] text-[hsl(var(--mood-bad-fg))] border-[hsl(var(--mood-bad-fg)/0.2)]",
  blue: "bg-[hsl(var(--mood-blue-bg))] text-[hsl(var(--mood-blue-fg))] border-[hsl(var(--mood-blue-fg)/0.2)]",
  purple: "bg-[hsl(var(--mood-purple-bg))] text-[hsl(var(--mood-purple-fg))] border-[hsl(var(--mood-purple-fg)/0.2)]",
};

export function SessionForm({ child, onSaved }: { child: Child; onSaved: () => void }) {
  const { user, profile } = useClinicAuth();
  const [moods, setMoods] = useState<{ v: string; c: string }[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [activities, setActivities] = useState("");
  const [observations, setObservations] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const dateLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const toggleSkill = (s: string) =>
    setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = [...files, ...Array.from(list)].slice(0, 10);
    setFiles(arr);
  };

  const save = async () => {
    if (!user || !profile) return;
    if (!observations.trim() && !activities.trim()) {
      toast({ title: "Preencha atividades ou observações", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: sess, error } = await supabase.from("cs_sessions").insert({
      child_id: child.id,
      professional_id: user.id,
      professional_name: profile.full_name,
      professional_role: profile.role_label,
      mood: moods.length ? moods.map((m) => m.v).join(", ") : null,
      mood_color: moods[0]?.c ?? null,
      skills,
      ratings,
      activities,
      observations,
      message_to_parents: message,
    }).select().single();

    if (error || !sess) {
      setSaving(false);
      toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" });
      return;
    }

    for (const f of files) {
      const path = `${(sess as any).id}/${Date.now()}-${f.name}`;
      const up = await supabase.storage.from("session-files").upload(path, f);
      if (!up.error) {
        await supabase.from("cs_session_attachments").insert({
          session_id: (sess as any).id,
          file_path: path,
          file_name: f.name,
          mime_type: f.type,
          is_image: f.type.startsWith("image/"),
        });
      }
    }

    setSaving(false);
    setMoods([]); setSkills([]); setRatings({}); setActivities(""); setObservations(""); setMessage(""); setFiles([]);
    toast({ title: "Registro salvo ✓" });
    onSaved();
  };

  return (
    <div className="card-soft space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">{dateLabel}</div>
          <div className="text-xs text-muted-foreground">Sessão com {child.name}</div>
        </div>
        <span className="chip bg-accent-yellow/30 text-secondary-foreground">{profile?.role_label.split(" ")[0]}</span>
      </div>

      <div>
        <Label className="mb-2 block">😊 Humor e disposição (pode marcar mais de um)</Label>
        <div className="grid grid-cols-2 gap-2">
          {MOODS.map((m) => {
            const on = moods.some((x) => x.v === m.v);
            return (
              <button key={m.v} type="button" onClick={() => setMoods((prev) => on ? prev.filter((x) => x.v !== m.v) : [...prev, { v: m.v, c: m.c }])}
                className={`text-sm rounded-xl px-3 py-2 border text-left transition ${on ? moodClass[m.c] : "bg-background border-border hover:bg-accent"}`}>
                {m.icon} {m.v}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">🎯 Áreas trabalhadas</Label>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => {
            const on = skills.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleSkill(s)}
                className={`text-xs rounded-full px-3 py-1.5 border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent"}`}>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">⭐ Avaliação das habilidades</Label>
        <div className="space-y-2">
          {RATING_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRatings((r) => ({ ...r, [key]: n }))}>
                    <Star className={`w-5 h-5 ${(ratings[key] ?? 0) >= n ? "fill-accent-yellow text-accent-yellow" : "text-muted-foreground/40"}`} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>🎮 Atividades realizadas</Label>
        <Textarea rows={2} value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="Ex: jogo de encaixe, leitura com pictogramas..." />
      </div>
      <div>
        <Label>📝 Observações da sessão</Label>
        <Textarea rows={4} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Conquistas, dificuldades, estratégias..." />
      </div>
      <div>
        <Label>💬 Recado para os pais</Label>
        <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensagem carinhosa para a família..." />
      </div>

      <div>
        <Label className="mb-2 block">📷 Fotos e anexos (até 10)</Label>
        <label className="block w-full rounded-xl border-2 border-dashed border-border px-4 py-6 text-center cursor-pointer hover:bg-accent">
          <Camera className="w-6 h-6 mx-auto text-muted-foreground" />
          <div className="text-sm mt-1">Toque para adicionar fotos ou arquivos</div>
          <div className="text-xs text-muted-foreground">Imagens, PDFs, docs</div>
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden"
            onChange={(e) => onFiles(e.target.files)} />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-muted px-2 py-1">
                <span className="truncate">{f.name}</span>
                <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving ? "Salvando..." : "✓ Salvar registro do dia"}
      </Button>
    </div>
  );
}
