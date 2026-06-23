import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Megaphone, Check, FileText, HeartPulse } from "lucide-react";
import { toast } from "sonner";

const KIND_LABEL: Record<string, { label: string; variant: any }> = {
  aviso: { label: "Aviso", variant: "secondary" },
  correcao_relatorio: { label: "Correção de relatório", variant: "destructive" },
  pedido_avaliacao: { label: "Pedido de avaliação", variant: "default" },
};

export function AnnouncementsFeed() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["announcements-feed", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements" as any)
        .select("*")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("announcements" as any)
        .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements-feed"] });
      toast.success("Recado marcado como resolvido.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Recados para você</CardTitle>
        <CardDescription>Avisos da diretoria, RTs e pedidos direcionados</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!data?.length && <p className="text-sm text-muted-foreground py-4 text-center">Sem recados no momento.</p>}
        {data?.map((a: any) => {
          const k = KIND_LABEL[a.kind] ?? KIND_LABEL.aviso;
          return (
            <div key={a.id} className="border rounded-md p-3 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={k.variant}>{k.label}</Badge>
                  <span className="font-medium text-sm">{a.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
              </div>
              {a.body && <p className="text-sm text-muted-foreground whitespace-pre-line">{a.body}</p>}
              <div className="flex items-center gap-2 pt-1">
                {a.report_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/reports/$reportId" params={{ reportId: a.report_id }} hash="preencher">
                      <FileText className="h-3 w-3 mr-1" /> Ver relatório
                    </Link>
                  </Button>
                )}
                {a.patient_id && !a.report_id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/patients">
                      <HeartPulse className="h-3 w-3 mr-1" /> Ver paciente
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => resolve.mutate(a.id)}>
                  <Check className="h-3 w-3 mr-1" /> Resolver
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
