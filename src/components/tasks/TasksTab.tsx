import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Activity, Pill, Wind, Scissors, ClipboardList, CheckCircle, LayoutList, Circle } from "lucide-react";
import {
  Card, Badge, Button, Stack, Inline, Text, EmptyState, Spinner, Surface,
  Modal, ConfirmDialog, FormField, TextArea, Select, FilterBar, DropdownMenu, IconButton, Alert,
} from "@/components/hms";
import { useTasks, type TaskRow, type TaskStatus, type TaskType } from "@/hooks/useTasks";
import type { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import { AdHocTaskModal } from "./AdHocTaskModal";

interface TasksTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

const TYPE_ICONS: Record<TaskType, typeof Activity> = {
  ADL: LayoutList,
  VITALS: Activity,
  MEDICATION_PREP: Pill,
  WOUND_CARE: Scissors,
  REPOSITIONING: Wind,
  ASSESSMENT: ClipboardList,
  FOLLOW_UP: CheckCircle,
  OTHER: Circle,
};

const STATUS_TONE: Record<TaskStatus, "neutral" | "warning" | "success" | "error" | "info"> = {
  PENDING: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  OVERDUE: "error",
  CANCELLED: "neutral",
};

function formatDateTime(d: string): string {
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function TasksTab({ residentId, branchId, staffId, logAction }: TasksTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [completing, setCompleting] = useState<TaskRow | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [cancelling, setCancelling] = useState<TaskRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { tasks, isLoading } = useTasks({ residentId, status: statusFilter });

  const groups: Record<TaskStatus, TaskRow[]> = {
    OVERDUE: [], PENDING: [], IN_PROGRESS: [], COMPLETED: [], CANCELLED: [],
  };
  for (const tk of tasks) groups[tk.status].push(tk);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["tasks", residentId] });

  const doComplete = async () => {
    if (!completing || !staffId) return;
    setBusy(true);
    setErr(null);
    try {
      const before = { status: completing.status, completed_at: completing.completed_at };
      const after = {
        status: "COMPLETED" as const,
        completed_at: new Date().toISOString(),
        completed_by: staffId,
        completion_notes: completionNotes.trim() || null,
      };
      const { error } = await supabase.from("tasks").update(after).eq("id", completing.id);
      if (error) throw error;
      await logAction({
        action: "TASK_COMPLETED",
        entity_type: "tasks",
        entity_id: completing.id,
        branch_id: branchId,
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
        branch_id: branchId,
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

  const renderTask = (task: TaskRow) => {
    const Icon = TYPE_ICONS[task.type] ?? Circle;
    const isActive = task.status === "PENDING" || task.status === "IN_PROGRESS";
    return (
      <Surface key={task.id} padding="sm">
        <Inline justify="between" align="start" className="w-full">
          <Inline gap={3} align="start">
            <span style={{ color: "var(--text-secondary)", marginTop: 2 }}><Icon size={20} /></span>
            <Stack gap={1}>
              <Inline gap={2} wrap>
                <Text size="md" className="font-semibold">{task.title}</Text>
                <Badge tone="neutral">{t(`tasks.type.${task.type}`)}</Badge>
                {task.icp_id && <Badge tone="info">{t("tasks.fromICP")}</Badge>}
              </Inline>
              <Text size="sm" color="tertiary">
                {t("tasks.dueAt")}: {formatDateTime(task.due_at)}
              </Text>
              {task.description && <Text size="sm" color="secondary">{task.description}</Text>}
            </Stack>
          </Inline>
          <Inline gap={2} align="center">
            <Badge tone={STATUS_TONE[task.status]}>{t(`tasks.status.${task.status}`)}</Badge>
            {task.assignee && (
              <Text size="sm" color="secondary">{task.assignee.name_zh ?? task.assignee.name}</Text>
            )}
            {isActive && (
              <DropdownMenu
                trigger={<IconButton aria-label="Actions" icon={<MoreHorizontal size={16} />} variant="ghost" size="compact" />}
                items={[
                  { label: t("tasks.completeTask"), onSelect: () => { setCompletionNotes(""); setCompleting(task); } },
                  { label: t("tasks.cancelTask"), tone: "destructive", onSelect: () => setCancelling(task) },
                ]}
              />
            )}
          </Inline>
        </Inline>
      </Surface>
    );
  };

  return (
    <Stack gap={4}>
      <FilterBar>
        <div style={{ width: 220 }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value as TaskStatus | "ALL")}
            options={[
              { value: "ALL", label: t("tasks.status.ALL") },
              { value: "PENDING", label: t("tasks.status.PENDING") },
              { value: "IN_PROGRESS", label: t("tasks.status.IN_PROGRESS") },
              { value: "COMPLETED", label: t("tasks.status.COMPLETED") },
              { value: "OVERDUE", label: t("tasks.status.OVERDUE") },
              { value: "CANCELLED", label: t("tasks.status.CANCELLED") },
            ]}
          />
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Button variant="primary" onClick={() => setAdHocOpen(true)} disabled={!staffId}>
            {t("tasks.addAdHoc")}
          </Button>
        </div>
      </FilterBar>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
          <Spinner size="md" />
        </div>
      ) : tasks.length === 0 ? (
        <Card padding="lg">
          <EmptyState title={t("tasks.noTasks")} />
        </Card>
      ) : (
        <Stack gap={3}>
          {groups.OVERDUE.length > 0 && (
            <Stack gap={2}>
              <Text size="label" color="tertiary">{t("tasks.status.OVERDUE")} ({groups.OVERDUE.length})</Text>
              {groups.OVERDUE.map(renderTask)}
            </Stack>
          )}
          {groups.PENDING.length > 0 && (
            <Stack gap={2}>
              <Text size="label" color="tertiary">{t("tasks.status.PENDING")} ({groups.PENDING.length})</Text>
              {groups.PENDING.map(renderTask)}
            </Stack>
          )}
          {groups.IN_PROGRESS.length > 0 && (
            <Stack gap={2}>
              <Text size="label" color="tertiary">{t("tasks.status.IN_PROGRESS")} ({groups.IN_PROGRESS.length})</Text>
              {groups.IN_PROGRESS.map(renderTask)}
            </Stack>
          )}
          {(groups.COMPLETED.length > 0 || groups.CANCELLED.length > 0) && (
            <Stack gap={2}>
              <Text size="label" color="tertiary">
                {t("tasks.status.COMPLETED")} / {t("tasks.status.CANCELLED")} ({groups.COMPLETED.length + groups.CANCELLED.length})
              </Text>
              {[...groups.COMPLETED, ...groups.CANCELLED].map(renderTask)}
            </Stack>
          )}
        </Stack>
      )}

      {staffId && (
        <AdHocTaskModal
          open={adHocOpen}
          onClose={() => setAdHocOpen(false)}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}

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
    </Stack>
  );
}
