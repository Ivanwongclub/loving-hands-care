import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { Suspense, lazy, useEffect } from "react";

// Dynamic import preserves tree-shaking when the flag is off.
// (touched to trigger Vite restart so .env.local is re-read)
console.log("[F3 DIAG] VITE_ENABLE_FEEDBACK value:", JSON.stringify(import.meta.env.VITE_ENABLE_FEEDBACK), "type:", typeof import.meta.env.VITE_ENABLE_FEEDBACK);
const FeedbackProvider = true // FIXME revert after F3 verification
  ? lazy(() =>
      import("@/features/feedback").then((m) => ({ default: m.FeedbackProvider })),
    )
  : null;
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";

import "@/i18n";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/AuthContext";
import { Spinner } from "@/components/hms";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { supabase } from "@/integrations/supabase/client";

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

// Fires once after login to warm the React Query cache for the most-visited pages.
// queryKeys must exactly match the keys used in useResidents / useTasks / useAlerts / useBranches.
function PrefetchWarmup() {
  const queryClient = useQueryClient();
  const { staff } = useCurrentStaff();

  useEffect(() => {
    if (!staff) return;
    const branchId = (staff.branch_ids ?? [])[0] ?? null;
    if (!branchId) return;

    // ["branches", staff.id] — matches useBranches queryKey
    void queryClient.prefetchQuery({
      queryKey: ["branches", staff.id],
      staleTime: 5 * 60_000,
      queryFn: async () => {
        let q = supabase.from("branches").select("*").eq("is_active", true);
        if (staff.role !== "SYSTEM_ADMIN") {
          if (!staff.branch_ids?.length) return [];
          q = q.in("id", staff.branch_ids);
        }
        const { data } = await q.order("name_zh", { ascending: true });
        return data ?? [];
      },
    });

    // ["residents", branchId, "", null, null, 1, 20] — matches useResidents default call
    void queryClient.prefetchQuery({
      queryKey: ["residents", branchId, "", null, null, 1, 20],
      staleTime: 5 * 60_000,
      queryFn: async () => {
        const { data, count } = await supabase
          .from("residents")
          .select("*, locations:bed_id(code, name)", { count: "exact" })
          .eq("branch_id", branchId)
          .is("deleted_at", null)
          .order("name_zh", { ascending: true })
          .range(0, 19);
        return { rows: data ?? [], count: count ?? 0 };
      },
    });

    // ["tasks", null, branchId, null, 1, 50] — matches useTasks default call in dashboard
    void queryClient.prefetchQuery({
      queryKey: ["tasks", null, branchId, null, 1, 50],
      staleTime: 5 * 60_000,
      queryFn: async () => {
        const { data, count } = await supabase
          .from("tasks")
          .select(
            "*, assignee:assigned_to(name, name_zh), completer:completed_by(name, name_zh), resident:resident_id(id, name, name_zh)",
            { count: "exact" },
          )
          .eq("branch_id", branchId)
          .order("due_at", { ascending: true })
          .range(0, 49);
        return { rows: data ?? [], count: count ?? 0 };
      },
    });

    // ["alerts", branchId, null, 1, 100] — matches useAlerts default call
    void queryClient.prefetchQuery({
      queryKey: ["alerts", branchId, null, 1, 100],
      staleTime: 5 * 60_000,
      queryFn: async () => {
        const { data, count } = await supabase
          .from("alerts")
          .select(
            "*, acknowledger:acknowledged_by(name, name_zh), resolver:resolved_by(name, name_zh), residents:resident_id(name, name_zh)",
            { count: "exact" },
          )
          .eq("branch_id", branchId)
          .order("triggered_at", { ascending: false })
          .range(0, 99);
        return { rows: data ?? [], total: count ?? 0 };
      },
    });
  // staff.id is the only meaningful dependency — we only re-prefetch when the logged-in user changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id]);

  return null;
}

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
  const inner = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PrefetchWarmup />
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

  if (FeedbackProvider) {
    return (
      <Suspense fallback={inner}>
        <FeedbackProvider>{inner}</FeedbackProvider>
      </Suspense>
    );
  }
  return inner;
}
