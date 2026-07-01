import { useState } from "react";
import { supabase } from "./db";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const QUICK = [
  { label: "💡 Atividades para comunicação", prompt: "Sugira 5 atividades práticas para trabalhar comunicação com uma criança com TEA não-verbal, usando materiais simples." },
  { label: "🧠 Regulação emocional", prompt: "Quais estratégias de regulação sensorial e emocional são mais eficazes em crianças com TEA com hipersensibilidade?" },
  { label: "📋 Rotina visual", prompt: "Como estruturar uma rotina visual eficaz para criança com TEA? Inclua exemplos para casa e escola." },
  { label: "💌 Apoio aos pais", prompt: "Escreva uma mensagem empática para pais de criança com TEA passando por uma fase desafiadora." },
  { label: "📱 Recursos e apps", prompt: "Liste os melhores apps e materiais gratuitos para apoiar crianças com TEA em casa." },
  { label: "📚 Explicar ABA", prompt: "Explique de forma simples e acolhedora para pais leigos o que é ABA e como pode ajudar." },
];

export function Assistant() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async (text?: string) => {
    const message = (text ?? q).trim();
    if (!message) return;
    setQ(message); setAnswer(""); setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: message }] }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Limite atingido. Tente em instantes.");
        if (resp.status === 402) throw new Error("Créditos da IA esgotados.");
        throw new Error("Erro na IA");
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "", acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { reader.cancel(); buf = ""; break; }
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) { acc += c; setAnswer(acc); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e: any) {
      toast({ title: "Falha", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-soft space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary/15 grid place-items-center text-lg">✨</div>
          <div>
            <div className="text-sm font-semibold">Subliminho</div>
            <div className="text-xs text-muted-foreground">Assistente clínico do grupo Sublime</div>
          </div>
        </div>
        <Label>Consultas rápidas</Label>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((quick) => (
            <button key={quick.label} onClick={() => ask(quick.prompt)} className="text-xs rounded-full px-3 py-1.5 border bg-background hover:bg-accent">
              {quick.label}
            </button>
          ))}
        </div>
        <Label>Sua pergunta</Label>
        <Textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escreva sua dúvida ou pedido..." />
        <Button className="w-full" onClick={() => ask()} disabled={loading}>
          {loading ? "Subliminho está pensando..." : "✨ Perguntar ao Subliminho"}
        </Button>
      </div>
      {answer && (
        <div className="card-soft prose prose-sm max-w-none">
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
