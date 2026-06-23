import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import subliminho from "@/assets/subliminho.png";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
      <img src={subliminho} alt="" className="h-40 mb-4 subliminho-anim select-none pointer-events-none" />
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm mt-1 max-w-sm">{description}</p>}
    </div>
  );
}

export function NewItemDialog({
  title,
  trigger,
  children,
  onSubmit,
  submitting,
  submitDisabled,
  open,
  onOpenChange,
}: {
  title: string;
  trigger?: ReactNode;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  submitDisabled?: boolean;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0"><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit();
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {children}
          </div>
          <DialogFooter className="shrink-0 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting || submitDisabled}>{submitting ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewButton({ onClick, label = "Novo" }: { onClick?: () => void; label?: string }) {
  return (
    <Button onClick={onClick}>
      <Plus className="h-4 w-4 mr-1" /> {label}
    </Button>
  );
}
