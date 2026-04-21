import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { Card, EmptyState } from "@/components/hms";

function IncidentsOverviewPage() {
  const { t } = useTranslation();
  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("nav.incidents")}>
        <Card padding="lg">
          <EmptyState
            title={t("incidents.overviewTitle")}
            description={t("incidents.overviewSoon")}
          />
        </Card>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/incidents")({
  component: IncidentsOverviewPage,
});
