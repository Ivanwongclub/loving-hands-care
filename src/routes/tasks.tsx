import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ListTodo } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { Card, EmptyState } from "@/components/hms";

function TasksOverviewPage() {
  const { t } = useTranslation();
  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("tasks.overviewTitle")}>
        <Card padding="lg">
          <EmptyState
            icon={<ListTodo size={36} />}
            title={t("tasks.overviewTitle")}
            description={t("tasks.comingSoon")}
          />
        </Card>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/tasks")({
  component: TasksOverviewPage,
});
