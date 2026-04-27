import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Users, BellRing, ListTodo, ClipboardCheck } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import {
  PageHeader, StatCard, Banner, Card, Table, type Column,
  TableToolbar, Badge, Timeline, ActivityItem, Text,
  Skeleton, EmptyState,
} from "@/components/hms";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { useResidents } from "@/hooks/useResidents";
import { useTasks, type TaskRow } from "@/hooks/useTasks";
import { useAlerts } from "@/hooks/useAlerts";
import { useBranches } from "@/hooks/useBranches";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const { branches } = useBranches();
  const branchId = branches[0]?.id ?? null;
  const { residents, isLoading: residentsLoading } = useResidents({ branchId });
  const { tasks, isLoading: tasksLoading } = useTasks({ branchId });
  const { alerts, isLoading: alertsLoading } = useAlerts({ branchId });
  const overdueTasks = tasks.filter((task) => task.status === "OVERDUE");
  const openAlerts = alerts.filter((a) => a.status === "OPEN" || a.status === "ACKNOWLEDGED");

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ["audit_logs_dashboard", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, created_at, staff:actor_id(name, name_zh)")
        .eq("branch_id", branchId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusTone: Record<string, "neutral" | "warning" | "info" | "error" | "success"> = {
    PENDING: "neutral", IN_PROGRESS: "info", OVERDUE: "error", COMPLETED: "success", CANCELLED: "neutral",
  };

  const cols: Column<TaskRow>[] = [
    { key: "id", header: "ID", cell: (r) => <span className="font-mono type-body-sm">{r.id.slice(-6).toUpperCase()}</span>, width: 80 },
    { key: "resident_id", header: t("nav.residents"), cell: (r) => r.resident?.name_zh ?? r.resident?.name ?? "—" },
    { key: "title", header: t("nav.tasks"), cell: (r) => r.title },
    { key: "due_at", header: "Due", cell: (r) => r.due_at ? new Date(r.due_at).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" }) : "—", width: 80 },
    { key: "assigned_to", header: "Assignee", cell: (r) => r.assignee?.name_zh ?? r.assignee?.name ?? t("tasks.unassigned"), width: 120 },
    { key: "status", header: "Status", cell: (r) => <Badge tone={statusTone[r.status] ?? "neutral"} dot>{t(`tasks.status.${r.status}`)}</Badge>, width: 130 },
  ];

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("dashboard.title")}>
        <PageHeader
          title={t("dashboard.title")}
          actions={<Badge tone="info" dot>{branches[0]?.name_zh ?? t("common.loading")}</Badge>}
        />

        {/* Stats — full width 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-5">
          {residentsLoading ? (
            <Skeleton variant="block" height={92} />
          ) : (
            <StatCard label={t("dashboard.residentsToday")} value={String(residents.length)} icon={<Users size={18} />} />
          )}
          {alertsLoading ? (
            <Skeleton variant="block" height={92} />
          ) : (
            <StatCard label={t("dashboard.openAlerts")} value={String(openAlerts.length)} tone="warning" icon={<BellRing size={18} />} />
          )}
          {tasksLoading ? (
            <Skeleton variant="block" height={92} />
          ) : (
            <StatCard label={t("dashboard.overdueTasks")} value={String(overdueTasks.length)} tone="error" icon={<ListTodo size={18} />} />
          )}
          {tasksLoading ? (
            <Skeleton variant="block" height={92} />
          ) : (
            <StatCard label={t("dashboard.dcuAttendance")} value={String(tasks.length)} tone="success" icon={<ClipboardCheck size={18} />} />
          )}
        </div>

        {/* Critical alert — only shown when open alerts exist */}
        {openAlerts.length > 0 && (
          <div className="mb-5">
            <Banner
              severity="critical"
              title={t("dashboard.criticalAlert")}
              description={`${openAlerts.length} ${t("dashboard.openAlertsDesc")}`}
            />
          </div>
        )}

        {/* Two-column 60/40 — full width */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 w-full">
          <div className="lg:col-span-3">
            <Card padding="none" header={
              <TableToolbar
                left={<Text className="type-h3">{t("dashboard.recentTasks")}</Text>}
                right={<Badge tone="neutral">{tasks.length} items</Badge>}
              />
            }>
              {tasksLoading ? (
                <div style={{ padding: "var(--space-4)" }}>
                  <Skeleton variant="row" />
                  <Skeleton variant="row" />
                  <Skeleton variant="row" />
                </div>
              ) : (
                <Table columns={cols} rows={tasks} rowKey={(r) => r.id} density="default" />
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card header={<Text className="type-h3">{t("dashboard.recentActivity")}</Text>}>
              {auditLoading ? (
                <Skeleton variant="block" height={128} />
              ) : auditLogs.length === 0 ? (
                <EmptyState title={t("dashboard.noActivity")} />
              ) : (
                <Timeline>
                  {auditLogs.map((log) => {
                    const actor = (log as any).staff;
                    const actorName = actor?.name_zh ?? actor?.name ?? t("audit.systemActor");
                    const action = String(log.action);
                    const tone = action.includes("ALERT") ? "error"
                      : action.includes("INCIDENT") ? "warning"
                      : action.includes("LOGIN") ? "info"
                      : "success";
                    return (
                      <ActivityItem
                        key={log.id}
                        timestamp={new Date(log.created_at).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}
                        actor={actorName}
                        action={`${log.action} · ${log.entity_type}`}
                        tone={tone}
                      />
                    );
                  })}
                </Timeline>
              )}
            </Card>
          </div>
        </div>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}
