import { useEffect, useState } from "react";
import { supabase } from "../db";
import { useDiaAuth } from "../use-dia-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, BookOpen, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import Reactions from "../Reactions";

interface Post { id: string; title: string; content: string; created_at: string; author_id: string | null; author_name: string | null; }

export default function Blog() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return selectedId
    ? <BlogPostView id={selectedId} onBack={() => setSelectedId(null)} />
    : <BlogList onOpen={setSelectedId} />;
}

function BlogList({ onOpen }: { onOpen: (id: string) => void }) {
  const { user, canBlog, isAdmin } = useDiaAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    supabase.from("dd_blog_posts").select("*").order("created_at", { ascending: false })
      .then(({ data }: any) => setPosts((data as any) ?? []));
  };
  useEffect(() => { load(); }, []);

  const publish = async () => {
    if (!title.trim() || !content.trim()) { toast.error("Preencha título e conteúdo"); return; }
    setSaving(true);
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
    const authorName = prof?.full_name || user?.email || "Equipe Sublime";
    const { error } = await supabase.from("dd_blog_posts").insert({
      title: title.trim(), content: content.trim(), author_id: user?.id, author_name: authorName,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Post publicado");
    setTitle(""); setContent(""); setOpen(false); load();
  };

  const remove = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Excluir este post?")) return;
    const { error } = await supabase.from("dd_blog_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const excerpt = (s: string, n = 140) => s.length > n ? s.slice(0, n).trimEnd() + "..." : s;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-sublime-navy">Blog</h1>
          <p className="text-sm text-muted-foreground">Artigos e novidades da Sublime</p>
        </div>
        {canBlog && (
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        )}
      </div>

      {canBlog && open && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea rows={6} placeholder="Escreva o conteúdo..." value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={publish} disabled={saving}>{saving ? "Publicando..." : "Publicar"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {posts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Nenhum post ainda.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {posts.map((p) => {
            const dt = new Date(p.created_at);
            return (
              <button key={p.id} onClick={() => onOpen(p.id)} className="block group text-left">
                <Card className="h-full shadow-sm transition-all group-hover:shadow-md group-hover:border-sublime-blue">
                  <CardContent className="p-4 flex flex-col h-full gap-2">
                    <div className="flex items-center gap-1.5 text-sublime-blue">
                      <BookOpen className="h-4 w-4" />
                      <span className="text-[10px] uppercase tracking-wider font-medium">Blog</span>
                    </div>
                    <h3 className="font-semibold text-sublime-navy line-clamp-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{excerpt(p.content)}</p>
                    <div className="pt-2 mt-auto text-xs text-muted-foreground flex items-center justify-between">
                      <span className="truncate">{p.author_name ?? "Equipe Sublime"}</span>
                      <span className="whitespace-nowrap">
                        {dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {(isAdmin || p.author_id === user?.id) && (
                      <span role="button" className="self-start -ml-2 inline-flex items-center text-sm text-muted-foreground hover:text-destructive px-2 py-1" onClick={(e) => remove(p.id, e)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Excluir
                      </span>
                    )}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BlogPostView({ id, onBack }: { id: string; onBack: () => void }) {
  const { user, isAdmin } = useDiaAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    supabase.from("dd_blog_posts").select("*").eq("id", id).maybeSingle()
      .then(({ data }: any) => { setPost(data as any); setLoading(false); });
  };
  useEffect(() => { load(); }, [id]);

  const canEdit = !!post && (isAdmin || post.author_id === user?.id);

  const startEdit = () => {
    if (!post) return;
    setTitle(post.title); setContent(post.content); setEditing(true);
  };

  const save = async () => {
    if (!post) return;
    if (!title.trim() || !content.trim()) { toast.error("Preencha título e conteúdo"); return; }
    setSaving(true);
    const { error } = await supabase.from("dd_blog_posts")
      .update({ title: title.trim(), content: content.trim() })
      .eq("id", post.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Post atualizado");
    setEditing(false); load();
  };

  const remove = async () => {
    if (!post) return;
    if (!confirm("Excluir este post?")) return;
    const { error } = await supabase.from("dd_blog_posts").delete().eq("id", post.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Post excluído");
    onBack();
  };

  if (loading) return <div className="p-4 text-muted-foreground">Carregando...</div>;
  if (!post) return (
    <div className="p-4 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
      <p className="mt-4 text-muted-foreground">Post não encontrado.</p>
    </div>
  );

  const dt = new Date(post.created_at);
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sublime-blue">
            <BookOpen className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wider font-medium">Blog</span>
          </div>

          {editing ? (
            <div className="space-y-3">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
              <Textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Conteúdo" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-sublime-navy">{post.title}</h1>
              <p className="text-base whitespace-pre-wrap leading-relaxed">{post.content}</p>
            </>
          )}

          <div className="pt-4 border-t text-sm text-muted-foreground">
            <p>Publicado por <span className="font-medium text-sublime-navy">{post.author_name ?? "Equipe Sublime"}</span></p>
            <p>{dt.toLocaleDateString("pt-BR")} às {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>

          {canEdit && !editing && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={remove}>
                <Trash2 className="h-3 w-3 mr-1" /> Excluir
              </Button>
            </div>
          )}

          <Reactions contentType="blog" contentId={post.id} />
        </CardContent>
      </Card>
    </div>
  );
}
