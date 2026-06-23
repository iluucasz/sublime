import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Check } from "lucide-react";
import { toast } from "sonner";

export function PendingProfessionalsAlert() {
  const { isRespTecnicoOrAdmin } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["pending-professionals"],
    enabled: isRespTecnicoOrAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, full_name, email, specialties(name), units(name), created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("professionals").update({ status: "ativo" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional aprovado");
      qc.invalidateQueries({ queryKey: ["pending-professionals"] });
      qc.invalidateQueries({ queryKey: ["professionals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isRespTecnicoOrAdmin || !data || data.length === 0) return null;

  return (
    <Card className="p-4 border-amber-300 bg-amber-50/60">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
          <UserPlus className="h-5 w-5 text-amber-800" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-amber-900">Profissionais aguardando aprovação</h3>
            <Badge variant="outline" className="bg-amber-200 text-amber-900 border-amber-300">{data.length}</Badge>
          </div>
          <ul className="space-y-2">
            {data.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-3 bg-white/70 rounded-md px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[p.specialties?.name, p.units?.name, p.email].filter(Boolean).join(" • ")}
                  </div>
                </div>
                <Button size="sm" onClick={() => approve.mutate(p.id)} disabled={approve.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <Link to="/professionals" className="text-xs text-amber-900 hover:underline">Gerenciar profissionais →</Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
