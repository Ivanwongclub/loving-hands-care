import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Stack,
  Inline,
  Text,
  Heading,
  Badge,
  Button,
  Card,
  EmptyState,
  Avatar,
  StatusDot,
  Divider,
} from "@/components/hms";
import type { TaskRow } from "@/hooks/useTasks";
import type { Database } from "@/integrations/supabase/types";

type StaffRole = Database["public"]["Enums"]["staff_role"];

interface RoundModeViewProps {
  tasks: TaskRow[];
  sessionCompleted: Set<string>;
  scopeFilter: "me" | "all";
  onScopeChange: (scope: "me" | "all") => void;
  onComplete: (task: TaskRow) => void;
  onCancel: (task: TaskRow) => void;
  onViewResident: (residentId: string) => void;
  onEndRound: () => void;
  onClearCompleted: () => void;
  staffRole: StaffRole | null;
}

function formatTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function RoundModeView({
  tasks,
  sessionCompleted,
  scopeFilter,
  onScopeChange,
  onComplete,
  onCancel,
  onViewResident,
  onEndRound,
  onClearCompleted,
  staffRole,
}: RoundModeViewProps) {
  const { t } = useTranslation();

  const pendingCount = useMemo(
    () => tasks.filter((tk) => tk.status !== "COMPLETED" && tk.status !== "CANCELLED").length,
    [tasks],
  );
  const overdueCount = useMemo(
    () => tasks.filter((tk) => tk.status === "OVERDUE").length,
    [tasks],
  );
  const completedCount = sessionCompleted.size;

  const showScopeToggle =
    staffRole === "NURSE" || staffRole === "CAREGIVER";

  // Empty: no tasks at all
  if (tasks.length === 0 && completedCount === 0) {
    return (
      <Stack gap={4}>
        <SessionBar
          pendingCount={pendingCount}
          overdueCount={overdueCount}
          completedCount={completedCount}
          scopeFilter={scopeFilter}
          onScopeChange={onScopeChange}
          onEndRound={onEndRound}
          onClearCompleted={onClearCompleted}
          showScopeToggle={showScopeToggle}
        />
        <Card padding="lg">
          <EmptyState
            title={
              scopeFilter === "me"
                ? t("tasks.round.noMyTasks")
                : t("tasks.round.noTasks")
            }
            description={t("tasks.round.allCaughtUp")}
          />
        </Card>
      </Stack>
    );
  }

  const allDoneInSession = pendingCount === 0 && completedCount > 0;

  return (
    <Stack gap={4}>
      <SessionBar
        pendingCount={pendingCount}
        overdueCount={overdueCount}
        completedCount={completedCount}
        scopeFilter={scopeFilter}
        onScopeChange={onScopeChange}
        onEndRound={onEndRound}
        onClearCompleted={onClearCompleted}
        showScopeToggle={showScopeToggle}
      />

      {allDoneInSession ? (
        <Card padding="lg">
          <EmptyState
            title={t("tasks.round.roundComplete")}
            description={t("tasks.round.allTasksCompleted", { count: completedCount })}
            action={
              <Button variant="primary" onClick={onEndRound}>
                {t("tasks.round.endRound")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDismissed={sessionCompleted.has(task.id)}
              onComplete={onComplete}
              onCancel={onCancel}
              onViewResident={onViewResident}
            />
          ))}
        </div>
      )}
    </Stack>
  );
}

/* ─────────── Session bar ─────────── */

interface SessionBarProps {
  pendingCount: number;
  overdueCount: number;
  completedCount: number;
  scopeFilter: "me" | "all";
  onScopeChange: (scope: "me" | "all") => void;
  onEndRound: () => void;
  onClearCompleted: () => void;
  showScopeToggle: boolean;
}

function SessionBar({
  pendingCount,
  overdueCount,
  completedCount,
  scopeFilter,
  onScopeChange,
  onEndRound,
  onClearCompleted,
  showScopeToggle,
}: SessionBarProps) {
  const { t } = useTranslation();
  return (
    <Card padding="md">
      <Inline justify="between" align="center" className="w-full" wrap>
        <Stack gap={1}>
          <Heading level={3}>{t("tasks.round.title")}</Heading>
          <Inline gap={3} align="center" wrap>
            <Inline gap={1} align="center">
              <StatusDot tone="warning" />
              <Text size="sm" color="secondary">
                {pendingCount} {t("tasks.round.pending")}
              </Text>
            </Inline>
            <Inline gap={1} align="center">
              <StatusDot tone="error" />
              <Text size="sm" color="secondary">
                {overdueCount} {t("tasks.round.overdue")}
              </Text>
            </Inline>
            <Inline gap={1} align="center">
              <StatusDot tone="success" />
              <Text size="sm" color="secondary">
                {completedCount} {t("tasks.round.completed")}
              </Text>
            </Inline>
          </Inline>
        </Stack>
        <Inline gap={2} align="center" wrap>
          {showScopeToggle && (
            <Inline gap={1}>
              <Button
                variant={scopeFilter === "me" ? "primary" : "ghost"}
                size="compact"
                onClick={() => onScopeChange("me")}
              >
                {t("tasks.round.myTasks")}
              </Button>
              <Button
                variant={scopeFilter === "all" ? "primary" : "ghost"}
                size="compact"
                onClick={() => onScopeChange("all")}
              >
                {t("tasks.round.allTasks")}
              </Button>
            </Inline>
          )}
          <Button
            variant="ghost"
            size="compact"
            onClick={onClearCompleted}
            disabled={completedCount === 0}
          >
            {t("tasks.round.clearCompleted")}
          </Button>
          <Button variant="ghost" size="compact" onClick={onEndRound}>
            {t("tasks.round.endRound")}
          </Button>
        </Inline>
      </Inline>
    </Card>
  );
}

/* ─────────── Task card ─────────── */

interface TaskCardProps {
  task: TaskRow;
  isDismissed: boolean;
  onComplete: (task: TaskRow) => void;
  onCancel: (task: TaskRow) => void;
  onViewResident: (residentId: string) => void;
}

function TaskCard({ task, isDismissed, onComplete, onCancel, onViewResident }: TaskCardProps) {
  const { t } = useTranslation();
  const isOverdue = task.status === "OVERDUE";
  const isInProgress = task.status === "IN_PROGRESS";
  const minutesLate = isOverdue
    ? Math.max(0, Math.floor((Date.now() - new Date(task.due_at).getTime()) / 60000))
    : 0;

  const residentNameZh = task.resident?.name_zh ?? "";
  const residentNameEn = task.resident?.name ?? "";
  const residentDisplay = residentNameZh || residentNameEn || t("tasks.round.unknownResident");

  const cardInner = (
    <Card padding="none" className="overflow-hidden" style={{ width: "100%" }}>
      <Stack gap={1}>
        {/* Resident identity */}
        <div
          style={{
            padding: 16,
            paddingBottom: 12,
            cursor: task.resident ? "pointer" : "default",
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (task.resident) onViewResident(task.resident.id);
          }}
        >
          <Inline gap={2} align="center">
            <Avatar name={residentNameZh || residentNameEn || "?"} size="sm" />
            <Stack gap={1}>
              <Text size="sm" className="font-medium">{residentDisplay}</Text>
              {residentNameZh && residentNameEn && residentNameZh !== residentNameEn && (
                <Text size="caption" color="tertiary">{residentNameEn}</Text>
              )}
            </Stack>
          </Inline>
        </div>

        <Divider />

        {/* Task body */}
        <div style={{ padding: 16, paddingTop: 12, paddingBottom: 12 }}>
          <Stack gap={2}>
            <Inline gap={2} align="center" justify="between">
              <Text size="md" className="font-semibold">{task.title}</Text>
              <Badge tone="neutral">{t(`tasks.type.${task.type}`)}</Badge>
            </Inline>

            <Text
              size="sm"
              style={{
                color: isOverdue ? "var(--status-error-accent)" : "var(--text-secondary)",
                fontWeight: isOverdue ? 500 : 400,
              }}
            >
              {formatTime(task.due_at)}
              {isOverdue && ` · ${t("tasks.round.lateMinutes", { count: minutesLate })}`}
              {isInProgress && ` · ${t("tasks.status.IN_PROGRESS")}`}
            </Text>

            {task.description && (
              <Text
                size="sm"
                color="secondary"
                style={{
                  borderLeft: "2px solid var(--border-subtle)",
                  paddingLeft: 8,
                  fontStyle: "italic",
                }}
              >
                {task.description}
              </Text>
            )}

            <Inline gap={2} align="center">
              <Text size="caption" color="secondary">
                {t("tasks.round.assignedTo")}:
              </Text>
              <Text
                size="caption"
                color={task.assignee ? "primary" : "tertiary"}
                style={{
                  fontWeight: task.assignee ? 500 : 400,
                  fontStyle: task.assignee ? "normal" : "italic",
                }}
              >
                {task.assignee?.name_zh ?? task.assignee?.name ?? t("tasks.round.unassigned")}
              </Text>
            </Inline>

            {task.icp_id && (
              <div>
                <Badge tone="info">{t("tasks.round.fromIcp")}</Badge>
              </div>
            )}
          </Stack>
        </div>

        <Divider />

        {/* Actions */}
        <div style={{ padding: 12 }}>
          <Inline gap={2}>
            <div style={{ flex: 1 }}>
              <Button
                variant={isOverdue ? "destructive" : "primary"}
                size="default"
                fullWidth
                onClick={() => onComplete(task)}
              >
                {t("tasks.complete")}
              </Button>
            </div>
            <Button variant="ghost" size="default" onClick={() => onCancel(task)}>
              {t("tasks.cancel")}
            </Button>
          </Inline>
        </div>
      </Stack>
    </Card>
  );

  if (!isDismissed) return cardInner;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ opacity: 0.38, pointerEvents: "none" }}>{cardInner}</div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "var(--status-success-bg)",
          color: "var(--status-success-text)",
          padding: "6px 14px",
          borderRadius: "var(--radius-pill)",
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        ✓ {t("tasks.round.completed")}
      </div>
    </div>
  );
}
