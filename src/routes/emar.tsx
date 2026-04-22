import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { Card, EmptyState, Stack } from "@/components/hms";

export const Route = createFileRoute("/emar")({
  component: EMAROverviewPage,
});

function EMAROverviewPage() {
  const { t } = useTranslation();
  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("emar.overviewTitle")}>
        <Stack gap={4}>
          <Card padding="lg">
            <EmptyState
              title={t("emar.overviewTitle")}
              description={t("emar.overviewSoon")}
            />
          </Card>
        </Stack>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}
