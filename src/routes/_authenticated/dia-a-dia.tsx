import { createFileRoute } from "@tanstack/react-router";
import { DiaADiaModule } from "@/components/dia-a-dia/DiaADiaModule";

export const Route = createFileRoute("/_authenticated/dia-a-dia")({
  head: () => ({ meta: [{ title: "Dia a Dia — ACT Sublime" }] }),
  component: DiaADiaPage,
});

function DiaADiaPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-primary">Dia a Dia</h1>
        <p className="text-sm text-muted-foreground">Grade, avisos, documentos e conteúdos para as famílias</p>
      </div>
      <DiaADiaModule />
    </div>
  );
}
