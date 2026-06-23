import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History } from "lucide-react";
import { useState } from "react";

type Props = {
  entityType: string;
  entityId: string;
  includeChildren?: boolean; // include rows where parent_id = entityId
  title?: string;
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Criado",
  UPDATE: "Editado",
  DELETE: "Excluído",
};

export function EditHistoryButton({ entityType, entityId, includeChildren, title = "Histórico de edições" }: Props) {
  const [open, setOpen] = useState(false);

  const { data: log } = useQuery({
    enabled: open && !!entityId,
    queryKey: ["edit_audit", entityType, entityId, includeChildren],
    queryFn: async () => {
      let q = supabase
        .from("edit_audit_log")
        .select("*")
        .eq("entity_type", entityType)
        .order("created_at", { ascending: false })
        .limit(200);
      if (includeChildren) {
        q = q.or(`entity_id.eq.${entityId},parent_id.eq.${entityId}`);
      } else {
        q = q.eq("entity_id", entityId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-1" /> Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!log?.length && (
            <p className="text-muted-foreground text-sm">Sem modificações registradas.</p>
          )}
          {log?.map((a: any) => (
            <div key={a.id} className="border rounded-md p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">
                  {ACTION_LABEL[a.action] ?? a.action} · {a.table_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                por {a.changed_by_name ?? "—"}
              </div>
              {a.field_changes && Object.keys(a.field_changes).length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {Object.entries(a.field_changes as Record<string, any>).map(([key, val]) => (
                    <li key={key}>
                      <span className="font-medium">{key}:</span>{" "}
                      <span className="text-muted-foreground line-through">
                        {formatVal(val?.old)}
                      </span>{" "}
                      → <span>{formatVal(val?.new)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatVal(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
