// Navegação interna do módulo Dia a Dia (substitui o react-router do app original).
// O shell mantém a "view" atual + params; as telas navegam via useDiaNav().go(view, params).
import { createContext, useContext } from "react";

export type DiaView =
  | "admin-home" | "pacientes" | "profissionais" | "usuarios" | "aprovacoes"
  | "avisos-admin" | "importar" | "grade-admin" | "documentos-admin"
  | "parent-home" | "grade" | "documentos" | "avisos" | "blog" | "podcast";

export type DiaParams = Record<string, string | undefined>;

type DiaNavCtx = {
  view: DiaView;
  params: DiaParams;
  go: (view: DiaView, params?: DiaParams) => void;
};

export const DiaNavContext = createContext<DiaNavCtx | null>(null);

export function useDiaNav() {
  const ctx = useContext(DiaNavContext);
  if (!ctx) throw new Error("useDiaNav deve ser usado dentro do DiaADiaModule");
  return ctx;
}
