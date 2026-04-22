import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { BellRing, History } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  PageHeader, FilterBar, SearchField, Select, Card, Stack, Inline, Text, Badge,
  Button, Skeleton, EmptyState, StatCard, Avatar, Alert as HmsAlert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { useAlerts, type AlertRow } from "@/hooks/useAlerts";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { EscalateModal } from "@/components/alerts/EscalateModal";
import { ResolveModal } from "@/components/alerts/ResolveModal";
import { AssignModal } from "@/components/alerts/AssignModal";
import { EscalationHistoryDrawer } from "@/components/alerts/EscalationHistoryDrawer";
import { timeAgo, formatDateTime, minutesSince, readSLA } from "@/components/alerts/timeUtils";

type AlertSource = Enums<"alert_source">;
type AlertSeverity = Enums<"alert_severity">;
type AlertStatus = Enums<"alert_status">;

const SOURCE_TONE: Record<AlertSource, "info" | "warning" | "neutral" | "error"> = {
  VITALS: "info",
  INCIDENT: "warning",
  MANUAL: "neutral",
  SYSTEM: "neutral",
  IOT: "info",
};

const SEVERITY_TONE: Record<AlertSeverity, "success" | "warning" | "error"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error",
  CRITICAL: "error",
};

const STATUS_TONE: Record<AlertStatus, "warning" | "info" | "success" | "neutral"> = {
  OPEN: "warning",
  ACKNOWLEDGED: "info",
  ASSIGNED: "info",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

function severityBorder(sev: AlertSeverity): string {
  switch (sev) {
    case "CRITICAL":
      return "4px solid var(--status-error-accent)";
    case "HIGH":
      return "4px solid var(--status-warning-accent)";
    case "MEDIUM":
      return "4px solid color-mix(in oklab, var(--status-warning-accent) 60%, transparent)";
    case "LOW":
    default:
      return "4px solid var(--border-subtle)";
  }
}

function AlertsDashboardPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { branches } = useBranches();
  const { staff } = useCurrentStaff();
  const { logAction } = useAuditLog();

  const branchId = branches[0]?.id ?? null;
  const branch = branches[0] ?? null;
  const sla = readSLA(branch?.sla_config);
  const staffId = staff?.id ?? null;

  const { alerts, isLoading } = useAlerts({ branchId, status: "ALL", page: 1, pageSize: 200 });

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const [escalateAlert, setEscalateAlert] = useState<AlertRow | null>(null);
  const [resolveAlert, setResolveAlert] = useState<AlertRow | null>(null);
  const [assignAlert, setAssignAlert] = useState<AlertRow | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  // Live-updating "now" so timeAgo refreshes without page reload
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Today (local midnight) ISO for audit_log counts
  const startOfTodayIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const autoEscalatedToday = useQuery({
    queryKey: ["audit-counts", "ALERT_AUTO_ESCALATED", branchId, "today", startOfTodayIso],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return 0;
      const { count, error } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("action", "ALERT_AUTO_ESCALATED")
        .gte("created_at", startOfTodayIso);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const manualEscalatedToday = useQuery({
    queryKey: ["audit-counts", "ALERT_ESCALATED", branchId, "today", startOfTodayIso],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return 0;
      const { count, error } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("action", "ALERT_ESCALATED")
        .gte("created_at", startOfTodayIso);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
      if (sourceFilter !== "ALL" && a.source !== sourceFilter) return false;
      if (q) {
        const n = `${a.residents?.name_zh ?? ""} ${a.residents?.name ?? ""}`.toLowerCase();
        if (!n.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, statusFilter, severityFilter, sourceFilter, search]);

  const stats = useMemo(() => {
    const open = alerts.filter((a) => a.status === "OPEN").length;
    const ack = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
    const assigned = alerts.filter((a) => a.status === "ASSIGNED").length;
    const resolved = alerts.filter((a) => a.status === "RESOLVED").length;
    const escalated = alerts.filter((a) => (a.escalation_level ?? 0) > 0).length;
    return { open, ack, assigned, resolved, escalated };
  }, [alerts]);

  const criticalOpen = useMemo(
    () =>
      alerts.filter(
        (a) => a.severity === "CRITICAL" && (a.status === "OPEN" || a.status === "ACKNOWLEDGED"),
      ).length,
    [alerts],
  );

  const handleAcknowledge = async (a: AlertRow) => {
    if (!staffId || !branchId) return;
    const before = { status: a.status };
    const after = { status: "ACKNOWLEDGED" as AlertStatus, acknowledged_by: staffId, acknowledged_at: new Date().toISOString() };
    const { error } = await supabase.from("alerts").update(after).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await logAction({
      action: "ALERT_ACKNOWLEDGED",
      entity_type: "alerts",
      entity_id: a.id,
      branch_id: branchId,
      before_state: before,
      after_state: after,
    });
    toast.success(t("alerts.acknowledgeSuccess"));
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const handleDismiss = async (a: AlertRow) => {
    if (!staffId || !branchId) return;
    const before = { status: a.status };
    const after = { status: "DISMISSED" as AlertStatus };
    const { error } = await supabase.from("alerts").update(after).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await logAction({
      action: "ALERT_DISMISSED",
      entity_type: "alerts",
      entity_id: a.id,
      branch_id: branchId,
      before_state: before,
      after_state: after,
    });
    toast.success(t("alerts.dismissSuccess"));
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("alerts.dashboard")}>
        <Stack gap={4}>
          <PageHeader title={t("alerts.dashboard")} />

          {criticalOpen > 0 && (
            <HmsAlert
              severity="critical"
              title={t("alerts.criticalBanner", { count: criticalOpen })}
            />
          )}

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
          >
            <StatCard label={t("alerts.stats.open")} value={stats.open} tone="warning" />
            <StatCard label={t("alerts.stats.acknowledged")} value={stats.ack} tone="info" />
            <StatCard label={t("alerts.stats.assigned")} value={stats.assigned} tone="info" />
            <StatCard label={t("alerts.stats.resolved")} value={stats.resolved} tone="success" />
            <StatCard label={t("alerts.stats.escalated")} value={stats.escalated} tone="error" />
          </div>

          <Inline gap={2} wrap align="center">
            <Badge tone="neutral">
              {t("alerts.autoEscalatedToday")}: {autoEscalatedToday.data ?? "—"} {t("alerts.timesUnit")}
            </Badge>
            <Badge tone="neutral">
              {t("alerts.manualEscalatedToday")}: {manualEscalatedToday.data ?? "—"} {t("alerts.timesUnit")}
            </Badge>
          </Inline>

          <FilterBar>
            <div style={{ width: 240 }}>
              <SearchField
                placeholder={t("alerts.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch("")}
              />
            </div>
            <div style={{ width: 180 }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
                options={[
                  { value: "ALL", label: t("alerts.allStatuses") },
                  { value: "OPEN", label: t("alerts.status.OPEN") },
                  { value: "ACKNOWLEDGED", label: t("alerts.status.ACKNOWLEDGED") },
                  { value: "ASSIGNED", label: t("alerts.status.ASSIGNED") },
                  { value: "RESOLVED", label: t("alerts.status.RESOLVED") },
                  { value: "DISMISSED", label: t("alerts.status.DISMISSED") },
                ]}
              />
            </div>
            <div style={{ width: 160 }}>
              <Select
                value={severityFilter}
                onChange={(e) => setSeverityFilter((e.target as HTMLSelectElement).value)}
                options={[
                  { value: "ALL", label: t("alerts.allSeverities") },
                  { value: "LOW", label: t("alerts.severity.LOW") },
                  { value: "MEDIUM", label: t("alerts.severity.MEDIUM") },
                  { value: "HIGH", label: t("alerts.severity.HIGH") },
                  { value: "CRITICAL", label: t("alerts.severity.CRITICAL") },
                ]}
              />
            </div>
            <div style={{ width: 160 }}>
              <Select
                value={sourceFilter}
                onChange={(e) => setSourceFilter((e.target as HTMLSelectElement).value)}
                options={[
                  { value: "ALL", label: t("alerts.allSources") },
                  { value: "VITALS", label: t("alerts.source.VITALS") },
                  { value: "INCIDENT", label: t("alerts.source.INCIDENT") },
                  { value: "SYSTEM", label: t("alerts.source.SYSTEM") },
                  { value: "MANUAL", label: t("alerts.source.MANUAL") },
                  { value: "IOT", label: t("alerts.source.IOT") },
                ]}
              />
            </div>
          </FilterBar>

          {isLoading ? (
            <Stack gap={3}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="row" height={120} />)}
            </Stack>
          ) : filtered.length === 0 ? (
            <Card padding="lg">
              <EmptyState icon={<BellRing size={40} />} title={t("alerts.noAlerts")} />
            </Card>
          ) : (
            <Stack gap={3}>
              {filtered.map((a) => {
                const elapsed = minutesSince(a.triggered_at);
                const exceededL2 = elapsed >= sla.alert_escalation_l2_minutes;
                const exceededL1 = !exceededL2 && elapsed >= sla.alert_escalation_l1_minutes;
                const escalated = (a.escalation_level ?? 0) > 0;

                return (
                  <Card key={a.id} padding="md">
                    <Stack gap={3}>
                      <Inline justify="between" align="start" wrap>
                        <Inline gap={2} wrap align="center">
                          <Badge tone={SOURCE_TONE[a.source]}>{t(`alerts.source.${a.source}`)}</Badge>
                          <Text size="sm" className="font-semibold">
                            {a.type === "VITALS_BREACH" ? t("alerts.type.VITALS_BREACH") : a.type}
                          </Text>
                          <Badge
                            tone={SEVERITY_TONE[a.severity]}
                            emphasis={a.severity === "CRITICAL" ? "strong" : "subtle"}
                          >
                            {t(`alerts.severity.${a.severity}`)}
                          </Badge>
                          <Badge tone={STATUS_TONE[a.status]}>{t(`alerts.status.${a.status}`)}</Badge>
                          {escalated && (
                            <Badge tone="error" emphasis="strong">
                              {t("alerts.escalated")} Lv.{a.escalation_level}
                            </Badge>
                          )}
                        </Inline>
                        <Text size="sm" color="tertiary">{formatDateTime(a.triggered_at)}</Text>
                      </Inline>

                      <Inline gap={3} align="center" wrap>
                        {a.residents && (
                          <Inline gap={2} align="center">
                            <Avatar name={a.residents.name_zh ?? a.residents.name} size="sm" />
                            <Text size="sm" className="font-semibold">{a.residents.name_zh ?? a.residents.name}</Text>
                          </Inline>
                        )}
                        <Text size="sm" color="secondary">{timeAgo(a.triggered_at, t)}</Text>
                        {escalated && a.last_escalated_at && (
                          <Text size="sm" color="tertiary">
                            {t("alerts.lastEscalatedAt")}: {timeAgo(a.last_escalated_at, t)}
                          </Text>
                        )}
                      </Inline>

                      {(exceededL1 || exceededL2) && (
                        <HmsAlert
                          severity={exceededL2 ? "error" : "warning"}
                          layout="inline"
                          title={exceededL2 ? t("alerts.exceededL2") : t("alerts.exceededL1")}
                        />
                      )}

                      <Inline gap={2} justify="end" wrap>
                        {escalated && (
                          <Button variant="ghost" size="compact" leadingIcon={<History size={14} />} onClick={() => setHistoryId(a.id)}>
                            {t("alerts.viewHistory")}
                          </Button>
                        )}
                        {a.status === "OPEN" && staffId && (
                          <>
                            <Button variant="ghost" size="compact" onClick={() => handleDismiss(a)}>{t("alerts.dismiss")}</Button>
                            <Button variant="soft" size="compact" onClick={() => setEscalateAlert(a)}>{t("alerts.escalate")}</Button>
                            <Button variant="soft" size="compact" onClick={() => setAssignAlert(a)}>{t("alerts.assign")}</Button>
                            <Button variant="primary" size="compact" onClick={() => handleAcknowledge(a)}>{t("alerts.acknowledge")}</Button>
                          </>
                        )}
                        {a.status === "ACKNOWLEDGED" && staffId && (
                          <>
                            <Button variant="soft" size="compact" onClick={() => setEscalateAlert(a)}>{t("alerts.escalate")}</Button>
                            <Button variant="primary" size="compact" onClick={() => setResolveAlert(a)}>{t("alerts.resolve")}</Button>
                          </>
                        )}
                        {a.status === "ASSIGNED" && staffId && (
                          <Button variant="primary" size="compact" onClick={() => setResolveAlert(a)}>{t("alerts.resolve")}</Button>
                        )}
                      </Inline>

                      {a.status === "RESOLVED" && a.resolution_notes && (
                        <Text size="sm" color="tertiary">{t("alerts.resolutionNotes")}: {a.resolution_notes}</Text>
                      )}
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          )}

          {branchId && (
            <>
              <EscalateModal
                open={!!escalateAlert}
                onClose={() => setEscalateAlert(null)}
                alert={escalateAlert}
                branchId={branchId}
                staffId={staffId}
                logAction={logAction}
              />
              <ResolveModal
                open={!!resolveAlert}
                onClose={() => setResolveAlert(null)}
                alert={resolveAlert}
                branchId={branchId}
                staffId={staffId}
                logAction={logAction}
              />
              <AssignModal
                open={!!assignAlert}
                onClose={() => setAssignAlert(null)}
                alert={assignAlert}
                branchId={branchId}
                staffId={staffId}
                logAction={logAction}
              />
            </>
          )}
          <EscalationHistoryDrawer
            open={!!historyId}
            onClose={() => setHistoryId(null)}
            alertId={historyId}
          />
        </Stack>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/alerts")({
  component: AlertsDashboardPage,
});
