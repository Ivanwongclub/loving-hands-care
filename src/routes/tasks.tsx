import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Stack,
  Inline,
  Text,
  Badge,
  Button,
  Select,
  SearchField,
  FilterBar,
  Table,
  type Column,
  Spinner,
  Avatar,
  DropdownMenu,
  IconButton,
  Modal,
  ConfirmDialog,
  FormField,
  TextArea,
  Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useTasks, type TaskRow, type TaskStatus, type TaskType } from "@/hooks/useTasks";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useBranches } from "@/hooks/useBranches";
import { useAuditLog } from "@/hooks/useAuditLog";

const STATUS_TONE: Record<TaskStatus, "neutral" | "warning" | "success" | "error" | "info"> = {
  PENDING: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  OVERDUE: "error",
  CANCELLED: "neutral",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function formatDateTime(d: string): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function TasksDashboardPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { staff } = useCurrentStaff();
  const { branches } = useBranches();
  const { logAction } = useAuditLog();

  const DEMO_BRANCH_ID = '10000000-0000-0000-0000-000000000001'; // DEMO ONLY — remove before production
  const branchId = staff?.branch_ids?.[0] ?? branches.find(b => b.id === DEMO_BRANCH_ID)?.id ?? branches[0]?.id ?? null;

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<TaskType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [completing, setCompleting] = useState<TaskRow | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [cancelling, setCancelling] = useState<TaskRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { tasks, isLoading } = useTasks({ branchId, status: statusFilter, pageSize: 200 });

  // Auto-flag overdue (silent system maintenance — no audit)
  useEffect(() => {
    if (!branchId) return;
    const now = new Date().toISOString();
    void supabase
      .from("tasks")
      .update({ status: "OVERDUE" })
      .eq("branch_id", branchId)
      .in("status", ["PENDING", "IN_PROGRESS"])
      .lt("due_at", now)
      .then(({ error }) => {
        if (!error) void qc.invalidateQueries({ queryKey: ["tasks"] });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Derived stats
  const stats = useMemo(() => {
    const now = new Date();
    let dueToday = 0;
    let overdue = 0;
    let pending = 0;
    let completedToday = 0;
    for (const tk of tasks) {
      const due = new Date(tk.due_at);
      if (tk.status !== "CANCELLED" && isSameDay(due, now)) dueToday += 1;
      if (tk.status === "OVERDUE" || ((tk.status === "PENDING" || tk.status === "IN_PROGRESS") && due < now)) {
        overdue += 1;
      }
      if (tk.status === "PENDING") pending += 1;
      if (tk.status === "COMPLETED" && tk.completed_at && isSameDay(new Date(tk.completed_at), now)) {
        completedToday += 1;
      }
    }
    return { dueToday, overdue, pending, completedToday };
  }, [tasks]);

  // Apply type + search filters client-side
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((tk) => {
      if (typeFilter !== "ALL" && tk.type !== typeFilter) return false;
      if (q) {
        const hay = [
          tk.title,
          tk.resident?.name ?? "",
          tk.resident?.name_zh ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, typeFilter, search]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["tasks"] });

  const doComplete = async () => {
    if (!completing || !staff) return;
    setBusy(true);
    setErr(null);
    try {
      const before = { status: completing.status, completed_at: completing.completed_at };
      const after = {
        status: "COMPLETED" as const,
        completed_at: new Date().toISOString(),
        completed_by: staff.id,
        completion_notes: completionNotes.trim() || null,
      };
      const { error } = await supabase.from("tasks").update(after).eq("id", completing.id);
      if (error) throw error;
      await logAction({
        action: "TASK_COMPLETED",
        entity_type: "tasks",
        entity_id: completing.id,
        branch_id: completing.branch_id,
        before_state: before,
        after_state: after,
      });
      toast.success(t("tasks.completeSuccess"));
      invalidate();
      setCompleting(null);
      setCompletionNotes("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      const before = { status: cancelling.status };
      const after = { status: "CANCELLED" as const };
      const { error } = await supabase.from("tasks").update(after).eq("id", cancelling.id);
      if (error) throw error;
      await logAction({
        action: "TASK_CANCELLED",
        entity_type: "tasks",
        entity_id: cancelling.id,
        branch_id: cancelling.branch_id,
        before_state: before,
        after_state: after,
      });
      toast.success(t("tasks.cancelSuccess"));
      invalidate();
      setCancelling(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const goToResident = (rid: string) => {
    void navigate({ to: "/residents/$id", params: { id: rid } });
  };

  const columns: Column<TaskRow>[] = [
    {
      key: "resident",
      header: t("tasks.residentName"),
      cell: (row) => (
        <Inline gap={2} align="center">
          <Avatar size="sm" name={row.resident?.name_zh ?? row.resident?.name ?? "?"} />
          <Stack gap={1}>
            <Text size="sm" className="font-medium">{row.resident?.name_zh ?? "—"}</Text>
            <Text size="sm" color="tertiary">{row.resident?.name ?? ""}</Text>
          </Stack>
        </Inline>
      ),
    },
    {
      key: "task",
      header: t("tasks.title"),
      cell: (row) => (
        <Stack gap={1}>
          <Text size="sm" className="font-semibold">{row.title}</Text>
          <Inline gap={1} wrap>
            <Badge tone="neutral">{t(`tasks.type.${row.type}`)}</Badge>
            {row.icp_id && <Badge tone="info">{t("tasks.fromICP")}</Badge>}
          </Inline>
        </Stack>
      ),
    },
    {
      key: "due",
      header: t("tasks.dueAt"),
      cell: (row) => {
        const due = new Date(row.due_at);
        const isOverdue = row.status === "OVERDUE" || ((row.status === "PENDING" || row.status === "IN_PROGRESS") && due < new Date());
        return (
          <span style={{ color: isOverdue ? "var(--status-error-accent)" : "var(--text-primary)" }}>
            {formatDateTime(row.due_at)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("residents.columns.status"),
      cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{t(`tasks.status.${row.status}`)}</Badge>,
    },
    {
      key: "assigned",
      header: t("tasks.assignedTo"),
      cell: (row) => (
        <Text size="sm" color={row.assignee ? "primary" : "tertiary"}>
          {row.assignee ? (row.assignee.name_zh ?? row.assignee.name) : t("tasks.unassigned")}
        </Text>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 56,
      cell: (row) => {
        const isActive = row.status === "PENDING" || row.status === "IN_PROGRESS" || row.status === "OVERDUE";
        const items: { label: string; onSelect: () => void; tone?: "default" | "destructive" }[] = [];
        if (isActive) {
          items.push({
            label: t("tasks.completeTask"),
            onSelect: () => { setCompletionNotes(""); setCompleting(row); },
          });
          items.push({
            label: t("tasks.cancelTask"),
            tone: "destructive",
            onSelect: () => setCancelling(row),
          });
        }
        items.push({
          label: t("tasks.viewResident"),
          onSelect: () => row.resident && goToResident(row.resident.id),
        });
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu
              trigger={<IconButton aria-label="Actions" icon={<MoreHorizontal size={16} />} variant="ghost" size="compact" />}
              items={items}
            />
          </div>
        );
      },
    },
  ];

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("tasks.overviewTitle")}>
        <Stack gap={4}>
          <PageHeader
            title={t("tasks.overviewTitle")}
            description={t("tasks.branchDashboard")}
          />

          {stats.overdue > 0 && (
            <Alert
              severity="warning"
              description={t("tasks.overdueWarning", { count: stats.overdue })}
            />
          )}

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <StatCard label={t("tasks.todayDue")} value={stats.dueToday} tone="info" />
            <StatCard label={t("tasks.overdueCount")} value={stats.overdue} tone="error" />
            <StatCard label={t("tasks.pendingCount")} value={stats.pending} tone="neutral" />
            <StatCard label={t("tasks.completedToday")} value={stats.completedToday} tone="success" />
          </div>

          <FilterBar>
            <div style={{ width: 200 }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value as TaskStatus | "ALL")}
                options={[
                  { value: "ALL", label: t("tasks.status.ALL") },
                  { value: "PENDING", label: t("tasks.status.PENDING") },
                  { value: "IN_PROGRESS", label: t("tasks.status.IN_PROGRESS") },
                  { value: "OVERDUE", label: t("tasks.status.OVERDUE") },
                  { value: "COMPLETED", label: t("tasks.status.COMPLETED") },
                  { value: "CANCELLED", label: t("tasks.status.CANCELLED") },
                ]}
              />
            </div>
            <div style={{ width: 200 }}>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter((e.target as HTMLSelectElement).value as TaskType | "ALL")}
                options={[
                  { value: "ALL", label: t("tasks.allTypes") },
                  { value: "ADL", label: t("tasks.type.ADL") },
                  { value: "VITALS", label: t("tasks.type.VITALS") },
                  { value: "MEDICATION_PREP", label: t("tasks.type.MEDICATION_PREP") },
                  { value: "WOUND_CARE", label: t("tasks.type.WOUND_CARE") },
                  { value: "REPOSITIONING", label: t("tasks.type.REPOSITIONING") },
                  { value: "ASSESSMENT", label: t("tasks.type.ASSESSMENT") },
                  { value: "FOLLOW_UP", label: t("tasks.type.FOLLOW_UP") },
                  { value: "OTHER", label: t("tasks.type.OTHER") },
                ]}
              />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <SearchField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("tasks.searchPlaceholder")}
              />
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Button
                variant="primary"
                onClick={() => {
                  toast.message(t("tasks.addFromResidentHint"));
                  void navigate({ to: "/residents" });
                }}
              >
                {t("tasks.new")}
              </Button>
            </div>
          </FilterBar>

          {isLoading ? (
            <div className="flex items-center justify-center" style={{ minHeight: 240 }}>
              <Spinner size="md" />
            </div>
          ) : filtered.length === 0 ? (
            <Card padding="lg">
              <EmptyState title={t("tasks.noTasksToday")} />
            </Card>
          ) : (
            <Table<TaskRow>
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              onRowClick={(r) => r.resident && goToResident(r.resident.id)}
              empty={<EmptyState title={t("tasks.noTasksToday")} />}
            />
          )}
        </Stack>

        <Modal
          open={!!completing}
          onClose={() => { setCompleting(null); setCompletionNotes(""); setErr(null); }}
          title={t("tasks.completeTask")}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => { setCompleting(null); setCompletionNotes(""); }} disabled={busy}>
                {t("actions.cancel")}
              </Button>
              <Button variant="primary" loading={busy} onClick={doComplete}>{t("tasks.complete")}</Button>
            </>
          }
        >
          <Stack gap={3}>
            {err && <Alert severity="error" description={err} />}
            <FormField label={t("tasks.completionNotes")}>
              <TextArea rows={3} value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} />
            </FormField>
          </Stack>
        </Modal>

        <ConfirmDialog
          open={!!cancelling}
          onClose={() => setCancelling(null)}
          onConfirm={doCancel}
          title={t("tasks.cancelTask")}
          summary={t("tasks.cancelConfirm")}
          confirmLabel={t("tasks.cancelTask")}
          cancelLabel={t("actions.cancel")}
        />
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/tasks")({
  component: TasksDashboardPage,
});
