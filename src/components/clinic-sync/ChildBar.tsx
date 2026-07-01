import { useEffect, useState } from "react";
import { supabase } from "./db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useClinicAuth } from "./use-clinic-auth";
import { Plus } from "lucide-react";

export type Child = {
  id: string;
  name: string;
  age: string | null;
  level: string | null;
  emoji: string | null;
};

const EMOJIS = ["👦", "👧", "🧒", "👼", "🌟", "🦋", "🌈", "🐬"];
const LEVELS = ["TEA Nível 1 (leve)", "TEA Nível 2 (moderado)", "TEA Nível 3 (severo)", "Em investigação", "Outro"];

export function ChildBar({
  children,
  activeId,
  onSelect,
  onChanged,
}: {
  children: Child[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const { isAdmin } = useClinicAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [level, setLevel] = useState(LEVELS[0]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("cs_children")
      .insert({ name: name.trim(), age, level, emoji })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setName(""); setAge(""); setOpen(false);
    onChanged();
    if (data) onSelect((data as any).id);
    toast({ title: "Criança adicionada" });
  };

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b bg-card">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm border transition ${
              activeId === c.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-accent"
            }`}
          >
            <span className="mr-1">{c.emoji ?? "🧒"}</span>{c.name}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 w-9 h-9 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-accent"
            aria-label="Adicionar criança"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar criança</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lucas Mendes" /></div>
            <div><Label>Idade</Label><Input value={age} onChange={(e) => setAge(e.target.value)} placeholder="6 anos" /></div>
            <div><Label>Diagnóstico / Nível</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div><Label>Emoji</Label>
              <div className="flex flex-wrap gap-2 text-xl">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => setEmoji(e)}
                    className={`w-10 h-10 rounded-md border ${emoji === e ? "bg-primary/15 border-primary" : "border-border"}`}>{e}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function useChildren() {
  const [items, setItems] = useState<Child[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const { data } = await supabase.from("cs_children").select("id,name,age,level,emoji").order("created_at");
    const list = (data ?? []) as Child[];
    setItems(list);
    setActiveId((prev) => prev && list.find((c) => c.id === prev) ? prev : (list[0]?.id ?? null));
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);
  return { items, activeId, setActiveId, reload, loading };
}
