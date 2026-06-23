import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Building2, HeartPulse, LogOut, FileText, LayoutTemplate, ClipboardCheck, Megaphone, Target, Printer, UserCircle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import logo from "@/assets/sublime-logo.png";
import { useAuth } from "@/hooks/use-auth";

type Item = { title: string; url: string; icon: any; leadOnly?: boolean };

const items: Item[] = [
  { title: "Painel Geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pacientes", url: "/patients", icon: HeartPulse },
  { title: "Usuários", url: "/usuarios", icon: Users, leadOnly: true },
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Impressões", url: "/impressoes", icon: Printer, leadOnly: true },
  { title: "Modelos de Relatório", url: "/templates", icon: LayoutTemplate, leadOnly: true },
  { title: "Avaliações", url: "/assessments", icon: ClipboardCheck },
  { title: "Recados", url: "/announcements", icon: Megaphone },
  { title: "Metas", url: "/goals", icon: Target, leadOnly: true },
  { title: "Unidades", url: "/units", icon: Building2, leadOnly: true },
  { title: "Meu Perfil", url: "/meu-perfil", icon: UserCircle },

];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut, isRespTecnicoOrAdmin } = useAuth();

  const visible = items.filter((i) => !i.leadOnly || isRespTecnicoOrAdmin);


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b h-14 p-0 justify-center">
        <Link to="/dashboard" className="flex items-center gap-2 px-3 h-full">
          <img src={logo} alt="Sublime" className="h-7 w-auto shrink-0" />
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-bold text-primary text-sm truncate">ACT Sublime</span>
              <span className="text-[10px] text-muted-foreground truncate">Acompanhamento Contínuo Transdisciplinar</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        {!collapsed && user && (
          <div className="px-2 py-1 text-xs text-muted-foreground truncate">{user.email}</div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
