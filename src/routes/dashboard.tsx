import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Users, BellRing, ListTodo, ClipboardCheck } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import {
  PageHeader, StatCard, Banner, Card, Table, type Column,
  TableToolbar, Badge, Timeline, ActivityItem, Inline, Stack, Text,
} from "@/components/hms";
import { ProtectedRoute } from "@/lib/ProtectedRoute";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

interface TaskRow {
  id: string;
  resident: string;
  task: string;
  due: string;
  assignee: string;
  status: "pending" | "inProgress" | "overdue" | "completed";
}

function DashboardPage() {
  const { t } = useTranslation();

  const tasks: TaskRow[] = [
    { id: "T-1041", resident: "Chan Tai Man · 陳大文", task: "Blood pressure check", due: "10:00", assignee: "RN Lee", status: "overdue" },
    { id: "T-1042", resident: "Wong Mei Ling · 黃美玲", task: "Insulin administration", due: "10:30", assignee: "RN Wong", status: "inProgress" },
    { id: "T-1043", resident: "Lam Chi Kit · 林志傑", task: "Wound dressing", due: "11:00", assignee: "RN Cheung", status: "pending" },
    { id: "T-1044", resident: "Ho Sau Lin · 何秀蓮", task: "Mobility assistance", due: "11:15", assignee: "HCA Tam", status: "pending" },
    { id: "T-1045", resident: "Yip Kwok Wing · 葉國榮", task: "Medication: Warfarin", due: "11:30", assignee: "RN Lee", status: "pending" },
  ];

  const statusTone: Record<TaskRow["status"], "neutral" | "warning" | "info" | "error" | "success"> = {
    pending: "neutral", inProgress: "info", overdue: "error", completed: "success",
  };

  const cols: Column<TaskRow>[] = [
    { key: "id", header: "ID", cell: (r) => <span className="font-mono type-body-sm">{r.id}</span>, width: 80 },
    { key: "resident", header: t("nav.residents"), cell: (r) => r.resident },
    { key: "task", header: t("nav.tasks"), cell: (r) => r.task },
    { key: "due", header: "Due", cell: (r) => r.due, width: 80 },
    { key: "assignee", header: "Assignee", cell: (r) => r.assignee, width: 120 },
    { key: "status", header: "Status", cell: (r) => <Badge tone={statusTone[r.status]} dot>{t(`taskStatus.${r.status}`)}</Badge>, width: 130 },
  ];

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("dashboard.title")}>
        <PageHeader
          title={t("dashboard.title")}
          actions={<Badge tone="info" dot>Central Branch · 中央院舍</Badge>}
        />

        {/* Stats — full width 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-5">
          <StatCard label={t("dashboard.residentsToday")} value="127" trend={{ direction: "up", value: "+2" }} icon={<Users size={18} />} />
          <StatCard label={t("dashboard.openAlerts")} value="3" tone="warning" icon={<BellRing size={18} />} />
          <StatCard label={t("dashboard.overdueTasks")} value="7" tone="error" icon={<ListTodo size={18} />} />
          <StatCard label={t("dashboard.dcuAttendance")} value="24/28" tone="success" icon={<ClipboardCheck size={18} />} />
        </div>

        {/* Critical alert */}
        <div className="mb-5">
          <Banner severity="critical" title={t("dashboard.criticalAlert")} description="Escalation L2 · 已升級至二級" />
        </div>

        {/* Two-column 60/40 — full width */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 w-full">
          <div className="lg:col-span-3">
            <Card padding="none" header={
              <TableToolbar
                left={<Text className="type-h3">{t("dashboard.recentTasks")}</Text>}
                right={<Badge tone="neutral">{tasks.length} items</Badge>}
              />
            }>
              <Table columns={cols} rows={tasks} rowKey={(r) => r.id} density="default" />
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card header={<Text className="type-h3">{t("dashboard.recentActivity")}</Text>}>
              <Timeline>
                <ActivityItem timestamp="09:42" actor="RN Lee" action="Administered Metformin to Chan Tai Man" tone="success" />
                <ActivityItem timestamp="09:38" actor="HCA Tam" action="Recorded vitals for Room 204" tone="info" />
                <ActivityItem timestamp="09:30" actor="System" action="Alert escalated: Room 305 call bell" tone="error" />
                <ActivityItem timestamp="09:15" actor="RN Wong" action="Completed handover for morning shift" />
                <ActivityItem timestamp="09:02" actor="Dr. Cheung" action="Approved ICP for Lam Chi Kit" tone="success" />
              </Timeline>
            </Card>
          </div>
        </div>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}
