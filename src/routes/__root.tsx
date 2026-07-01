import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { RouterProvider as HeroUIRouterProvider } from "@heroui/react";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Ir para o início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ACT Sublime — Acompanhamento Contínuo Transdisciplinar" },
      { name: "description", content: "Sistema de acompanhamento transdisciplinar do Grupo Sublime: pacientes, avaliações, relatórios e estudos de caso." },
      { property: "og:title", content: "ACT Sublime — Acompanhamento Contínuo Transdisciplinar" },
      { name: "twitter:title", content: "ACT Sublime — Acompanhamento Contínuo Transdisciplinar" },
      { property: "og:description", content: "Sistema de acompanhamento transdisciplinar do Grupo Sublime: pacientes, avaliações, relatórios e estudos de caso." },
      { name: "twitter:description", content: "Sistema de acompanhamento transdisciplinar do Grupo Sublime: pacientes, avaliações, relatórios e estudos de caso." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dbb61298-efbd-428e-9e58-a6014e945a02/id-preview-561e6150--dd82cbe7-39cd-49b7-90b2-cf3b9884204c.lovable.app-1779970978953.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dbb61298-efbd-428e-9e58-a6014e945a02/id-preview-561e6150--dd82cbe7-39cd-49b7-90b2-cf3b9884204c.lovable.app-1779970978953.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    // heroui.min.css (CSS compilado do HeroUI v3, vendorizado em public/) carrega
    // ANTES do CSS do app, para que os tokens/reset do shadcn vençam em conflitos.
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: "/heroui.min.css" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIRouterProvider navigate={(to) => router.navigate({ to })}>
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </HeroUIRouterProvider>
    </QueryClientProvider>
  );
}
