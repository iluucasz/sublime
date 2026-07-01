import { createFileRoute } from "@tanstack/react-router";
import { ClinicSyncModule } from "@/components/clinic-sync/ClinicSyncModule";

export const Route = createFileRoute("/_authenticated/clinic-sync")({
  head: () => ({ meta: [{ title: "Clinic Sync — ACT Sublime" }] }),
  component: ClinicSyncPage,
});

function ClinicSyncPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-primary">Clinic Sync</h1>
        <p className="text-sm text-muted-foreground">Registro de sessões, diário, relatórios e indicadores</p>
      </div>
      <ClinicSyncModule />
    </div>
  );
}
