import { useEffect, useState } from "react";
import { supabase } from "../db";
import { useDiaAuth } from "../use-dia-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Headphones, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import Reactions from "../Reactions";

interface Episode { id: string; title: string; description: string | null; audio_path: string; created_at: string; author_id: string | null; author_name: string | null; }

export default function Podcast() {
  const { user, canPodcast, isAdmin } = useDiaAuth();
  const [items, setItems] = useState<Episode[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = () => {
    supabase.from("dd_podcast_episodes").select("*").order("created_at", { ascending: false })
      .then(({ data }: any) => setItems((data as any) ?? []));
  };
  useEffect(() => { load(); }, []);

  const publicUrl = (path: string) =>
    supabase.storage.from("podcasts").getPublicUrl(path).data.publicUrl;

  const publish = async () => {
    if (!title.trim() || !file) { toast.error("Preencha título e selecione um áudio"); return; }
    setSaving(true);
    const ext = file.name.split(".").pop() || "mp3";
    const path = `${user?.id}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("podcasts").upload(path, file, { contentType: file.type || "audio/mpeg" });
    if (up.error) { setSaving(false); toast.error(up.error.message); return; }
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
    const authorName = prof?.full_name || user?.email || "Equipe Sublime";
    const { error } = await supabase.from("dd_podcast_episodes").insert({
      title: title.trim(), description: description.trim() || null, audio_path: path, author_id: user?.id, author_name: authorName,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Episódio publicado");
    setTitle(""); setDescription(""); setFile(null); setOpen(false); load();
  };

  const startEdit = (ep: Episode) => {
    setEditingId(ep.id); setEditTitle(ep.title); setEditDesc(ep.description ?? "");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) { toast.error("Preencha o título"); return; }
    setEditSaving(true);
    const { error } = await supabase.from("dd_podcast_episodes")
      .update({ title: editTitle.trim(), description: editDesc.trim() || null })
      .eq("id", id);
    setEditSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Episódio atualizado");
    setEditingId(null); load();
  };

  const remove = async (ep: Episode) => {
    if (!confirm("Excluir este episódio?")) return;
    await supabase.storage.from("podcasts").remove([ep.audio_path]);
    const { error } = await supabase.from("dd_podcast_episodes").delete().eq("id", ep.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-sublime-navy">Podcast</h1>
          <p className="text-sm text-muted-foreground">Episódios em áudio da Sublime</p>
        </div>
        {canPodcast && (
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        )}
      </div>

      {canPodcast && open && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea rows={3} placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={publish} disabled={saving}>{saving ? "Enviando..." : "Publicar"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Headphones className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nenhum episódio ainda.
        </CardContent></Card>
      ) : (
        <div className="relative pl-6 space-y-4 border-l-2 border-border ml-2">
          {items.map((ep) => {
            const canEdit = isAdmin || ep.author_id === user?.id;
            const isEditing = editingId === ep.id;
            return (
              <div key={ep.id} className="relative">
                <span className="absolute -left-[31px] top-3 h-4 w-4 rounded-full ring-4 ring-background bg-sublime-pink" />
                <Card className="shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título" />
                        <Textarea rows={3} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descrição" />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                          <Button size="sm" onClick={() => saveEdit(ep.id)} disabled={editSaving}>
                            {editSaving ? "Salvando..." : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold text-sublime-navy">{ep.title}</h3>
                        {ep.description && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ep.description}</p>}
                      </>
                    )}
                    <audio controls preload="none" src={publicUrl(ep.audio_path)} className="w-full" />
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      <p>Publicado por <span className="font-medium text-sublime-navy">{ep.author_name ?? "Equipe Sublime"}</span></p>
                      <p>{new Date(ep.created_at).toLocaleDateString("pt-BR")} às {new Date(ep.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <Reactions contentType="podcast" contentId={ep.id} />
                    {canEdit && !isEditing && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(ep)}>
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(ep)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Excluir
                        </Button>
                      </div>
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
