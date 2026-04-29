import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatAuditAction } from "@/lib/auditFormat";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import {
  PageHeader,
  StatCard,
  Alert,
  Card,
  Table,
  type Column,
  Badge,
  Text,
  Heading,
  Skeleton,
  EmptyState,
  HandoverPanel,
  Button,
  Inline,
  Stack,
  Surface,
  StatusDot,
} from "@/components/hms";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { useAlerts } from "@/hooks/useAlerts";
import { useBranches } from "@/hooks/useBranches";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/components/alerts/timeUtils";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

/* ──────────────── types ──────────────── */

interface ResidentLite {
  id?: string;
  name: string | null;
  name_zh: string | null;
}

interface StaffLite {
  name: string | null;
  name_zh: string | null;
}

interface TodayTaskRow {
  id: string;
  title: string;
  type: string;
  status: string;
  due_at: string;
  assigned_to: string | null;
  resident_id: string;
  residents: ResidentLite | null;
  assignee: StaffLite | null;
}

interface MedDueRow {
  id: string;
  due_at: string;
  status: string;
  residents: ResidentLite | null;
  order: {
    drug_name: string | null;
    drug_name_zh: string | null;
    dose: string | null;
  } | null;
}

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  actor: StaffLite | null;
}

/* ──────────────── helpers ──────────────── */

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" });
}

/* ──────────────── component ──────────────── */

function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { branches } = useBranches();
  const branchId = branches[0]?.id ?? null;

  const { alerts, isLoading: alertsLoading } = useAlerts({ branchId, status: "OPEN" });
  const criticalAlerts = useMemo(
    () => alerts.filter((a) => a.severity === "CRITICAL"),
    [alerts],
  );

  const [census, setCensus] = useState({ admitted: 0, loa: 0, discharged: 0 });
  const [todayTasks, setTodayTasks] = useState<TodayTaskRow[]>([]);
  const [dcuCount, setDcuCount] = useState(0);
  const [medsNext2h, setMedsNext2h] = useState<MedDueRow[]>([]);
  const [incidentCount, setIncidentCount] = useState(0);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!branchId) return;

    // 1. Census
    const censusP = Promise.all([
      supabase.from("residents").select("id", { count: "exact", head: true })
        .eq("branch_id", branchId).eq("status", "ADMITTED").is("deleted_at", null),
      supabase.from("residents").select("id", { count: "exact", head: true })
        .eq("branch_id", branchId).eq("status", "LOA").is("deleted_at", null),
      supabase.from("residents").select("id", { count: "exact", head: true })
        .eq("branch_id", branchId).eq("status", "DISCHARGED").is("deleted_at", null),
    ]).then(([a, l, d]) => {
      setCensus({
        admitted: a.count ?? 0,
        loa: l.count ?? 0,
        discharged: d.count ?? 0,
      });
    });

    // 2. Today's tasks
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
    const tasksP = supabase
      .from("tasks")
      .select(
        "id, title, type, status, due_at, assigned_to, resident_id, residents:resident_id(id, name, name_zh), assignee:assigned_to(name, name_zh)",
      )
      .eq("branch_id", branchId)
      .gte("due_at", dayStart)
      .lte("due_at", dayEnd)
      .in("status", ["PENDING", "IN_PROGRESS", "OVERDUE"])
      .order("due_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as TodayTaskRow[];
        // OVERDUE first, then by due_at
        rows.sort((a, b) => {
          if (a.status === "OVERDUE" && b.status !== "OVERDUE") return -1;
          if (b.status === "OVERDUE" && a.status !== "OVERDUE") return 1;
          return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        });
        setTodayTasks(rows);
      });

    // 3. DCU check-ins today
    const todayDate = today.toISOString().slice(0, 10);
    const dcuP = supabase
      .from("attendance_events")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("event_type", "CHECK_IN")
      .gte("event_time", `${todayDate}T00:00:00`)
      .lte("event_time", `${todayDate}T23:59:59`)
      .then(({ count }) => setDcuCount(count ?? 0));

    // 4. Meds due next 2h
    const nowIso = new Date().toISOString();
    const in2hIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const medsP = supabase
      .from("emar_records")
      .select(
        "id, due_at, status, residents:resident_id(name, name_zh), order:order_id(drug_name, drug_name_zh, dose)",
      )
      .eq("branch_id", branchId)
      .eq("status", "DUE")
      .gte("due_at", nowIso)
      .lte("due_at", in2hIso)
      .order("due_at", { ascending: true })
      .limit(10)
      .then(({ data }) => setMedsNext2h((data ?? []) as unknown as MedDueRow[]));

    // 5. Incidents last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const incidentsP = supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .gte("created_at", since)
      .then(({ count }) => setIncidentCount(count ?? 0));

    // 6. Recent activity
    const activityP = supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at, actor:actor_id(name, name_zh)")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setActivity((data ?? []) as unknown as ActivityRow[]));

    await Promise.all([censusP, tasksP, dcuP, medsP, incidentsP, activityP]);
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    void refreshAll().then(() => setInitialLoaded(true));
    const interval = setInterval(() => {
      void refreshAll();
    }, 60_000);
    return () => clearInterval(interval);
  }, [branchId, refreshAll]);

  const overdueCount = useMemo(
    () => todayTasks.filter((task) => task.status === "OVERDUE").length,
    [todayTasks],
  );

  const ready = initialLoaded && !alertsLoading;

  /* ──────────────── stat cards ──────────────── */

  const statCards: Array<{
    key: string;
    label: string;
    value: number;
    tone: "neutral" | "success" | "warning" | "error" | "info";
    onClick: () => void;
  }> = [
    {
      key: "admitted",
      label: t("dashboard.admittedResidents"),
      value: census.admitted,
      tone: "neutral",
      onClick: () => navigate({ to: "/residents" }),
    },
    {
      key: "alerts",
      label: t("dashboard.openAlerts"),
      value: alerts.length,
      tone: alerts.length > 0 ? "error" : "neutral",
      onClick: () => navigate({ to: "/alerts" }),
    },
    {
      key: "overdue",
      label: t("dashboard.overdueTasks"),
      value: overdueCount,
      tone: overdueCount > 0 ? "warning" : "neutral",
      onClick: () => navigate({ to: "/tasks" }),
    },
    {
      key: "dcu",
      label: t("dashboard.dcuCheckins"),
      value: dcuCount,
      tone: "info",
      onClick: () => navigate({ to: "/attendance/register" }),
    },
  ];

  /* ──────────────── tasks table ──────────────── */

  const taskCols: Column<TodayTaskRow>[] = [
    {
      key: "resident",
      header: t("residents.title"),
      cell: (r) => (
        <Stack gap={1}>
          <Text size="sm" className="font-medium">{r.residents?.name_zh ?? "—"}</Text>
          <Text size="caption" color="tertiary">{r.residents?.name ?? ""}</Text>
        </Stack>
      ),
    },
    {
      key: "task",
      header: t("tasks.title"),
      cell: (r) => (
        <Inline gap={2}>
          <Text size="sm">{r.title}</Text>
          <Badge tone="neutral">{r.type}</Badge>
        </Inline>
      ),
    },
    {
      key: "due",
      header: t("tasks.due"),
      cell: (r) => (
        <Text
          size="sm"
          style={{
            color: r.status === "OVERDUE" ? "var(--status-error-accent)" : "var(--text-primary)",
          }}
        >
          {formatTime(r.due_at)}
        </Text>
      ),
      width: 90,
    },
    {
      key: "status",
      header: t("tasks.status.PENDING") ? t("common.status", { defaultValue: "Status" }) : "Status",
      cell: (r) => (
        <Badge
          tone={
            r.status === "OVERDUE" ? "error" :
            r.status === "IN_PROGRESS" ? "info" : "neutral"
          }
        >
          {t(`tasks.status.${r.status}`, { defaultValue: r.status })}
        </Badge>
      ),
      width: 130,
    },
  ];

  /* ──────────────── handover sections ──────────────── */

  const handoverSections = [
    {
      title: t("dashboard.handover.alerts"),
      count: alerts.length,
      items: alerts.length === 0
        ? [<Text key="empty" size="sm" color="tertiary">{t("dashboard.empty.noAlerts")}</Text>]
        : alerts.slice(0, 3).map((a) => (
            <Inline key={a.id} gap={2} align="center">
              <StatusDot tone={a.severity === "CRITICAL" ? "error" : "warning"} />
              <Text size="sm" className="flex-1">
                {a.type}{a.residents?.name_zh ? ` — ${a.residents.name_zh}` : ""}
              </Text>
            </Inline>
          )),
    },
    {
      title: t("dashboard.handover.medsNext2h"),
      count: medsNext2h.length,
      items: medsNext2h.length === 0
        ? [<Text key="empty" size="sm" color="tertiary">{t("dashboard.empty.noMedsDue")}</Text>]
        : medsNext2h.slice(0, 3).map((m) => (
            <Inline key={m.id} gap={2}>
              <Text size="sm" className="font-medium">{formatTime(m.due_at)}</Text>
              <Text size="sm">
                {(m.order?.drug_name_zh ?? m.order?.drug_name ?? "")} — {m.residents?.name_zh ?? ""}
              </Text>
            </Inline>
          )),
    },
    {
      title: t("dashboard.handover.recentActivity"),
      count: activity.length,
      items: activity.length === 0
        ? [<Text key="empty" size="sm" color="tertiary">{t("dashboard.empty.noActivity")}</Text>]
        : activity.map((a) => (
            <Stack key={a.id} gap={1}>
              <Text size="sm">{formatAuditAction(a.action, t)}</Text>
              <Text size="caption" color="tertiary">
                {(a.actor?.name_zh ?? a.actor?.name ?? t("audit.systemActor"))}
                {" · "}
                {timeAgo(a.created_at, t)}
              </Text>
            </Stack>
          )),
    },
  ];

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("dashboard.title")}>
        <PageHeader
          title={t("dashboard.title")}
          actions={
            <Inline gap={2}>
              <Badge tone="info" dot>{branches[0]?.name_zh ?? t("common.loading")}</Badge>
              {incidentCount > 0 && (
                <Badge tone="warning" dot>
                  {t("dashboard.incidents24h", { count: incidentCount })}
                </Badge>
              )}
            </Inline>
          }
        />

        {/* STAT BAR */}
        <div
          className="w-full"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "var(--space-3)",
            marginBottom: "var(--space-5)",
          }}
        >
          {statCards.map((c) => (
            <div
              key={c.key}
              role="button"
              tabIndex={0}
              onClick={c.onClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  c.onClick();
                }
              }}
              style={{ cursor: "pointer", borderRadius: "var(--radius-md)", outline: "none" }}
              className="focus-visible:shadow-[var(--shadow-focus-glow)]"
            >
              {!ready ? (
                <Skeleton variant="block" height={108} />
              ) : (
                <StatCard label={c.label} value={c.value} tone={c.tone} />
              )}
            </div>
          ))}
        </div>

        {/* CRITICAL ALERT BANNER */}
        {ready && criticalAlerts.length > 0 && (
          <Stack gap={2} style={{ marginBottom: "var(--space-5)" }}>
            <Alert
              severity="critical"
              title={t("dashboard.criticalAlertBanner", { count: criticalAlerts.length })}
              description={
                criticalAlerts[0].type +
                (criticalAlerts[0].residents?.name_zh ? ` — ${criticalAlerts[0].residents.name_zh}` : "")
              }
            />
            <div style={{ marginLeft: "auto" }}>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => navigate({ to: "/alerts" })}
              >
                {t("dashboard.viewAlerts")}
              </Button>
            </div>
          </Stack>
        )}

        {/* TWO-COLUMN: TASKS (3/5) | HANDOVER (2/5) */}
        <div
          className="grid grid-cols-1 lg:grid-cols-5 w-full"
          style={{ gap: "var(--space-5)", marginBottom: "var(--space-5)" }}
        >
          <div className="lg:col-span-3">
            <Card padding="md">
              <Inline justify="between" align="center" style={{ marginBottom: "var(--space-3)" }}>
                <Heading level={3}>{t("dashboard.todayTasks")}</Heading>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => navigate({ to: "/tasks" })}
                >
                  {t("dashboard.viewAllTasks")} →
                </Button>
              </Inline>

              {!ready ? (
                <Stack gap={2}>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="row" height={48} />
                  ))}
                </Stack>
              ) : todayTasks.length === 0 ? (
                <EmptyState
                  title={t("dashboard.todayTasksEmpty")}
                  description={t("dashboard.todayTasksEmptyHint")}
                />
              ) : (
                <>
                  <Table
                    columns={taskCols}
                    rows={todayTasks.slice(0, 8)}
                    rowKey={(r) => r.id}
                    density="default"
                    onRowClick={(r) => {
                      const rid = r.residents?.id ?? r.resident_id;
                      if (rid) navigate({ to: "/residents/$id", params: { id: rid } });
                    }}
                  />
                  {todayTasks.length > 8 && (
                    <Text
                      size="sm"
                      color="secondary"
                      as="div"
                      className="text-center"
                      style={{ marginTop: "var(--space-3)" }}
                    >
                      {t("dashboard.todayTaskMore", { count: todayTasks.length - 8 })}
                    </Text>
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card padding="md">
              <Heading level={3} style={{ marginBottom: "var(--space-3)" }}>
                {t("dashboard.handover.title")}
              </Heading>
              {!ready ? (
                <Skeleton variant="block" height={400} />
              ) : (
                <Stack gap={3}>
                  {handoverSections.map((s, i) => (
                    <Surface key={i} padding="sm" elevation="flat" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <Inline justify="between" align="center" style={{ marginBottom: "var(--space-2)" }}>
                        <Text size="md" className="font-semibold">{s.title}</Text>
                        <Badge tone="neutral">{s.count}</Badge>
                      </Inline>
                      <Stack gap={2}>
                        {s.items.map((it, k) => <div key={k}>{it}</div>)}
                      </Stack>
                    </Surface>
                  ))}
                </Stack>
              )}
              {/* Suppress unused warning by referencing the imported component */}
              {false && <HandoverPanel sections={[]} />}
            </Card>
          </div>
        </div>

        {/* CENSUS STRIP */}
        <Surface padding="sm">
          {!ready ? (
            <Skeleton variant="text" height={20} />
          ) : (
            <Inline gap={6} justify="center" wrap>
              <Inline gap={2}>
                <StatusDot tone="info" />
                <Text size="sm">
                  {t("residents.status.ADMITTED")}: <strong>{census.admitted}</strong>
                </Text>
              </Inline>
              <Inline gap={2}>
                <StatusDot tone="warning" />
                <Text size="sm">
                  {t("residents.status.LOA")}: <strong>{census.loa}</strong>
                </Text>
              </Inline>
              <Inline gap={2}>
                <StatusDot tone="neutral" />
                <Text size="sm">
                  {t("residents.status.DISCHARGED")}: <strong>{census.discharged}</strong>
                </Text>
              </Inline>
            </Inline>
          )}
        </Surface>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}
