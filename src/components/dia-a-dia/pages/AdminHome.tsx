import { useEffect, useState } from "react";
import { supabase } from "../db";
import { useDiaNav } from "../DiaNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Bell, Calendar } from "lucide-react";

export default function AdminHome() {
  const { go } = useDiaNav();
  const [stats, setStats] = useState({ patients: 0, docs: 0, notices: 0, schedule: 0, professionals: 0 });
  useEffect(() => {
    Promise.all([
      supabase.from("dd_patients").select("*", { count: "exact", head: true }),
      supabase.from("dd_documents").select("*", { count: "exact", head: true }),
      supabase.from("dd_notices").select("*", { count: "exact", head: true }),
      supabase.from("dd_therapy_schedule").select("*", { count: "exact", head: true }),
      supabase.from("dd_professionals").select("*", { count: "exact", head: true }),
    ]).then(([p, d, n, s, profs]: any[]) => setStats({ patients: p.count ?? 0, docs: d.count ?? 0, notices: n.count ?? 0, schedule: s.count ?? 0, professionals: profs.count ?? 0 }));
  }, []);

  const cards = [
    { label: "Pacientes", value: stats.patients, icon: Users, color: "text-sublime-blue" },
    { label: "Profissionais", value: stats.professionals, icon: Users, color: "text-sublime-pink" },
    { label: "Documentos", value: stats.docs, icon: FileText, color: "text-sublime-yellow" },
    { label: "Horários", value: stats.schedule, icon: Calendar, color: "text-sublime-navy" },
    { label: "Avisos", value: stats.notices, icon: Bell, color: "text-sublime-blue" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-sublime-navy">Painel Administrativo</h1>
        <p className="text-muted-foreground">Gerencie pacientes, documentos, grades e avisos</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-8">
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-sublime-navy border-b pb-2">Módulos Clínicos</h2>
          <div className="grid gap-3">
            <button className="text-left" onClick={() => go("grade-admin")}><Card className="hover:shadow-md transition-shadow"><CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-sublime-blue" /><div><p className="font-semibold text-sm">Grade Terapêutica</p><p className="text-xs text-muted-foreground">Visualizar grade por paciente</p></div>
            </CardContent></Card></button>
            <button className="text-left" onClick={() => go("documentos-admin", { type: "therapy_plan" })}><Card className="hover:shadow-md transition-shadow"><CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-6 w-6 text-sublime-blue" /><div><p className="font-semibold text-sm">Planejamento Terapêutico</p></div>
            </CardContent></Card></button>
            <button className="text-left" onClick={() => go("documentos-admin", { type: "semester_report" })}><Card className="hover:shadow-md transition-shadow"><CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-6 w-6 text-sublime-yellow" /><div><p className="font-semibold text-sm">Relatório Semestral</p></div>
            </CardContent></Card></button>
            <button className="text-left" onClick={() => go("documentos-admin", { type: "aba_report" })}><Card className="hover:shadow-md transition-shadow"><CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-6 w-6 text-sublime-pink" /><div><p className="font-semibold text-sm">Relatórios em ABA</p></div>
            </CardContent></Card></button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-sublime-navy border-b pb-2">Comunicação</h2>
          <div className="grid gap-3">
            <button className="text-left" onClick={() => go("avisos-admin")}><Card className="hover:shadow-md transition-shadow"><CardContent className="p-4 flex items-center gap-3">
              <Bell className="h-6 w-6 text-sublime-blue" /><div><p className="font-semibold text-sm">Avisos</p><p className="text-xs text-muted-foreground">Disparar comunicados por setor</p></div>
            </CardContent></Card></button>
          </div>
        </div>
      </div>
    </div>
  );
}
