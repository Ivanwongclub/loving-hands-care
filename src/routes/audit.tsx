import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Stack, Inline, Card, PageHeader, FilterBar, FormField, Select, DateField,
  Table, Badge, Button, Skeleton, EmptyState, Alert, type Column,
} from "@/components/hms";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { supabase } from "@/integrations/supabase/client";
import { AuditDetailDrawer, type AuditLogRow } from "@/components/audit/AuditDetailDrawer";

const PAGE_SIZE = 50;

const ENTITY_TYPES = [
  "residents", "staff", "medication_orders", "emar_records", "tasks",
  "incidents", "alerts", "vitals", "wounds", "branches", "icp_plans", "audit_logs",
];

const ACTIONS = [
  "RESIDENT_ADMITTED", "RESIDENT_DISCHARGED", "RESIDENT_TRANSFERRED",
  "STAFF_CREATED", "STAFF_UPDATED", "STAFF_PIN_SET", "STAFF_PIN_UNLOCKED", "STAFF_DEACTIVATED",
  "MEDICATION_ORDER_CREATED", "MEDICATION_ORDER_STOPPED",
  "EMAR_ADMINISTERED", "EMAR_REFUSED", "EMAR_HELD",
  "VITALS_RECORDED", "VITALS_THRESHOLDS_SET",
  "WOUND_CREATED", "WOUND_ENTRY_ADDED",
  "INCIDENT_REPORTED", "INCIDENT_UPDATED", "INCIDENT_CLOSED",
  "ALERT_ACKNOWLEDGED", "ALERT_ESCALATED", "ALERT_RESOLVED",
  "TASK_COMPLETED", "ICP_SUBMITTED", "ICP_APPROVED",
  "ATTENDANCE_MANUAL_OVERRIDE", "SLA_CONFIG_UPDATED",
];

function formatTimestamp(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
}

function defaultDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function deriveSummary(log: AuditLogRow): string {
  const after = log.after_state as Record<string, unknown> | null;
  if (after) {
    if (typeof after.status === "string") return `→ ${after.status}`;
    if (after.administered_at) return `給藥 ${log.entity_id.slice(0, 8)}`;
    if (typeof after.escalation_level === "number") return `升級 Lv.${after.escalation_level}`;
  }
  return `${log.entity_id.slice(0, 8)}…`;
}

function AuditLogViewerPage() {
  const { t } = useTranslation();
  const { branches } = useBranches();
  const { staff } = useCurrentStaff();
  const branchId = branches[0]?.id ?? null;

  const [fromDate, setFromDate] = useState(defaultDate(7));
  const [toDate, setToDate] = useState(defaultDate(0));
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [entityFilter, setEntityFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [fromDate, toDate, actionFilter, entityFilter, branchId]);

  const allowed = staff?.role === "SYSTEM_ADMIN" || staff?.role === "BRANCH_ADMIN";

  const queryKey = ["auditLogs", branchId, fromDate, toDate, actionFilter, entityFilter, page] as const;
  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!branchId && allowed,
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("audit_logs")
        .select("*, actor:actor_id(name, name_zh)", { count: "exact" })
        .eq("branch_id", branchId!)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (actionFilter !== "ALL") q = q.eq("action", actionFilter);
      if (entityFilter !== "ALL") q = q.eq("entity_type", entityFilter);
      if (fromDate) q = q.gte("created_at", `${fromDate}T00:00:00`);
      if (toDate) q = q.lte("created_at", `${toDate}T23:59:59`);
      const { data: rows, count, error } = await q;
      if (error) throw error;
      return { rows: (rows ?? []) as unknown as AuditLogRow[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<AuditLogRow>[] = useMemo(() => [
    {
      key: "ts", header: t("audit.timestamp"),
      cell: (r) => (
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
          {formatTimestamp(r.created_at)}
        </span>
      ),
    },
    {
      key: "action", header: t("audit.action"),
      cell: (r) => (
        <Badge tone="neutral" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>
          {r.action}
        </Badge>
      ),
    },
    {
      key: "entity", header: t("audit.entity"),
      cell: (r) => (
        <Badge tone="neutral" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>
          {r.entity_type}
        </Badge>
      ),
    },
    {
      key: "actor", header: t("audit.actor"),
      cell: (r) => r.actor?.name_zh || r.actor?.name || t("audit.systemActor"),
    },
    {
      key: "summary", header: t("audit.summary"),
      cell: (r) => <span style={{ color: "var(--text-secondary)" }}>{deriveSummary(r)}</span>,
    },
    {
      key: "actions", header: "",
      cell: (r) => (
        <Button variant="ghost" size="compact" onClick={() => setDetail(r)}>
          {t("audit.viewDetail")}
        </Button>
      ),
    },
  ], [t]);

  if (!allowed) {
    return (
      <ProtectedRoute>
        <AdminDesktopShell pageTitle={t("audit.viewerTitle")}>
          <Stack gap={4}>
            <PageHeader title={t("audit.viewerTitle")} />
            <Card padding="md">
              <EmptyState icon={<Inbox size={48} />} title={t("audit.insufficientPermissions")} />
            </Card>
          </Stack>
        </AdminDesktopShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("audit.viewerTitle")}>
        <Stack gap={4}>
          <PageHeader title={t("audit.viewerTitle")} />

          <Alert severity="info" title={t("audit.sensitiveWarning")} />

          <Card padding="md">
            <Stack gap={3}>
              <FilterBar>
                <div style={{ width: 180 }}>
                  <FormField label={t("reports.from")}>
                    <DateField value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </FormField>
                </div>
                <div style={{ width: 180 }}>
                  <FormField label={t("reports.to")}>
                    <DateField value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </FormField>
                </div>
                <div style={{ width: 220 }}>
                  <FormField label={t("audit.filterByEntity")}>
                    <Select
                      value={entityFilter}
                      onChange={(e) => setEntityFilter((e.target as HTMLSelectElement).value)}
                      options={[
                        { value: "ALL", label: t("audit.allEntities") },
                        ...ENTITY_TYPES.map((v) => ({ value: v, label: v })),
                      ]}
                    />
                  </FormField>
                </div>
                <div style={{ width: 280 }}>
                  <FormField label={t("audit.filterByAction")}>
                    <Select
                      value={actionFilter}
                      onChange={(e) => setActionFilter((e.target as HTMLSelectElement).value)}
                      options={[
                        { value: "ALL", label: t("audit.allActions") },
                        ...ACTIONS.map((v) => ({ value: v, label: v })),
                      ]}
                    />
                  </FormField>
                </div>
              </FilterBar>

              {isLoading ? (
                <Stack gap={2}>
                  <Skeleton variant="row" />
                  <Skeleton variant="row" />
                  <Skeleton variant="row" />
                  <Skeleton variant="row" />
                  <Skeleton variant="row" />
                </Stack>
              ) : rows.length === 0 ? (
                <EmptyState title={t("audit.noLogs")} />
              ) : (
                <Table<AuditLogRow>
                  columns={columns}
                  rows={rows}
                  rowKey={(r) => r.id}
                  density="compact"
                  onRowClick={(r) => setDetail(r)}
                />
              )}

              <Inline justify="between" align="center">
                <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>
                  {t("audit.totalRecords", { count: total })}
                </span>
                <Inline gap={2} align="center">
                  <Button variant="ghost" size="compact" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    ← {t("actions.previous", "上一頁")}
                  </Button>
                  <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>
                    {t("audit.page", { current: page, total: totalPages })}
                  </span>
                  <Button variant="ghost" size="compact" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    {t("actions.next", "下一頁")} →
                  </Button>
                </Inline>
              </Inline>
            </Stack>
          </Card>
        </Stack>

        <AuditDetailDrawer open={!!detail} onClose={() => setDetail(null)} log={detail} />
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/audit")({
  component: AuditLogViewerPage,
});
