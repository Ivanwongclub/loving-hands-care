import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@/i18n";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/AuthContext";
import { Spinner } from "@/components/hms";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Helping Hand - HMS" },
      { name: "description", content: "Enterprise HMS" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Helping Hand - HMS" },
      { property: "og:description", content: "Enterprise HMS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Helping Hand - HMS" },
      { name: "twitter:description", content: "Enterprise HMS" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/71b85e82-832c-4032-a06c-1bf372d780d2/id-preview-c8fa4aff--8f9b80b1-6f55-45ad-ba9c-96688bd5f891.lovable.app-1776832646536.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/71b85e82-832c-4032-a06c-1bf372d780d2/id-preview-c8fa4aff--8f9b80b1-6f55-45ad-ba9c-96688bd5f891.lovable.app-1776832646536.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={
          <div className="flex items-center justify-center h-64 w-full">
            <Spinner size="lg" />
          </div>
        }>
          <Outlet />
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}
