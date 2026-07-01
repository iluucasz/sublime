import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Building2, HeartPulse, LogOut, FileText, LayoutTemplate,
  ClipboardCheck, Megaphone, Target, Printer, UserCircle, Sparkles, CalendarHeart,
} from "lucide-react";
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
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "Principal",
    items: [
      { title: "Painel Geral", url: "/dashboard", icon: LayoutDashboard },
      { title: "Pacientes", url: "/patients", icon: HeartPulse },
      { title: "Avaliações", url: "/assessments", icon: ClipboardCheck },
      { title: "Relatórios", url: "/reports", icon: FileText },
      { title: "Recados", url: "/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Módulos",
    items: [
      { title: "Clinic Sync", url: "/clinic-sync", icon: Sparkles },
      { title: "Dia a Dia", url: "/dia-a-dia", icon: CalendarHeart },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Usuários", url: "/usuarios", icon: Users, leadOnly: true },
      { title: "Unidades", url: "/units", icon: Building2, leadOnly: true },
      { title: "Metas", url: "/goals", icon: Target, leadOnly: true },
      { title: "Modelos de Relatório", url: "/templates", icon: LayoutTemplate, leadOnly: true },
      { title: "Impressões", url: "/impressoes", icon: Printer, leadOnly: true },
    ],
  },
  {
    label: "Conta",
    items: [{ title: "Meu Perfil", url: "/meu-perfil", icon: UserCircle }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut, isRespTecnicoOrAdmin } = useAuth();

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 border-b border-sidebar-border p-0 justify-center">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-3 h-full">
          <img src={logo} alt="Sublime" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-bold text-[0.95rem] text-foreground truncate">ACT Sublime</span>
              <span className="text-[11px] text-muted-foreground truncate">Acompanhamento Transdisciplinar</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2 gap-0.5">
        {groups.map((group) => {
          const visible = group.items.filter((i) => !i.leadOnly || isRespTecnicoOrAdmin);
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label} className="py-1">
              {!collapsed && (
                <SidebarGroupLabel className="px-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visible.map((item) => {
                    const active = pathname.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className={`h-9 rounded-lg text-[0.9rem] font-medium transition-colors
                            data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold
                            hover:bg-sidebar-accent`}
                        >
                          <Link to={item.url} className="flex items-center gap-2.5">
                            <item.icon className="h-[18px] w-[18px] shrink-0" />
                            {!collapsed && <span className="truncate">{item.title}</span>}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium text-foreground truncate">{user?.email?.split("@")[0]}</span>
              <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => signOut()}
              title="Sair"
              className="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => signOut()} tooltip="Sair" className="justify-center">
                <LogOut className="h-4 w-4" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
