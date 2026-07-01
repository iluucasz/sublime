// Shim de compatibilidade: os módulos portados (Clinic Sync / Dia a Dia) foram
// escritos para o hook de toast do shadcn/radix. No app principal usamos sonner,
// então mapeamos a API `toast({ title, description, variant })` para o sonner.
import { toast as sonnerToast } from "sonner";

type ToastArgs = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | null;
};

export function toast({ title, description, variant }: ToastArgs) {
  const message = title ?? description ?? "";
  const opts = title && description ? { description } : undefined;
  if (variant === "destructive") return sonnerToast.error(message, opts);
  return sonnerToast(message, opts);
}

export function useToast() {
  return { toast };
}
