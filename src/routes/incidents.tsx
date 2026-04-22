import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Card, Stack, Inline, Badge, Button, EmptyState, Skeleton, Select, FormField,
  StatCard, PageHeader, FilterBar, SearchField, Table, type Column,
} from "@/components/hms";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useIncidents, type IncidentRow } from "@/hooks/useIncidents";
import { IncidentDetailDrawer } from "@/components/incidents/IncidentDetailDrawer";
import type { Enums } from "@/integrations/supabase/types";

type Severity = Enums<"incident_severity">;
type Status = Enums<"incident_status">;

const SEVERITY_TONE: Record<Severity, "success" | "warning" | "error"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error",
  CRITICAL: "error",
};
const STATUS_TONE: Record<Status, "warning" | "info" | "neutral"> = {
  OPEN: "warning",
  UNDER_REVIEW: "info",
  CLOSED: "neutral",
};

const TYPE_KEYS = ["FALL", "MEDICATION_ERROR", "BEHAVIOUR", "MEDICAL_EMERGENCY", "EQUIPMENT", "OTHER"] as const;

function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

function IncidentsDashboardPage() {
  const { t } = useTranslation();
  const { branches } = useBranches();
  const { staff } = useCurrentStaff();
  const { logAction } = useAuditLog();
  const DEMO_BRANCH_ID = '10000000-0000-0000-0000-000000000001'; // DEMO ONLY — remove before production
  const branchId = branches.find(b => b.id === DEMO_BRANCH_ID)?.id ?? branches[0]?.id ?? null;

  const { incidents, isLoading } = useIncidents({ branchId, page: 1, pageSize: 100 });

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<IncidentRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && i.type !== typeFilter) return false;
      if (q) {
        const desc = i.description?.toLowerCase() ?? "";
        const rn = `${i.residents?.name ?? ""} ${i.residents?.name_zh ?? ""}`.toLowerCase();
        if (!desc.includes(q) && !rn.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, statusFilter, typeFilter, search]);

  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return {
      open: incidents.filter((i) => i.status === "OPEN").length,
      review: incidents.filter((i) => i.status === "UNDER_REVIEW").length,
      critical: incidents.filter((i) => i.severity === "CRITICAL").length,
      thisMonth: incidents.filter((i) => {
        const d = new Date(i.occurred_at);
        return d.getMonth() === month && d.getFullYear() === year;
      }).length,
    };
  }, [incidents]);

  const columns: Column<IncidentRow>[] = [
    { key: "ref", header: t("incidents.columns.ref"), cell: (r) => <span style={{ fontFamily: "monospace" }}>{r.incident_ref}</span> },
    { key: "type", header: t("incidents.columns.type"), cell: (r) => <Badge tone="info">{t(`incidents.type.${r.type}`)}</Badge> },
    {
      key: "severity",
      header: t("incidents.columns.severity"),
      cell: (r) => (
        <Badge tone={SEVERITY_TONE[r.severity]} emphasis={r.severity === "CRITICAL" ? "strong" : "subtle"}>
          {t(`incidents.severity.${r.severity}`)}
        </Badge>
      ),
    },
    {
      key: "resident",
      header: t("incidents.columns.resident"),
      cell: (r) => r.residents ? (r.residents.name_zh || r.residents.name) : "—",
    },
    { key: "occurred", header: t("incidents.columns.occurredAt"), cell: (r) => formatDateTime(r.occurred_at) },
    { key: "status", header: t("incidents.columns.status"), cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`incidents.status.${r.status}`)}</Badge> },
    { key: "reporter", header: t("incidents.columns.reporter"), cell: (r) => r.reporter ? (r.reporter.name_zh || r.reporter.name) : "—" },
    {
      key: "actions",
      header: t("incidents.columns.actions"),
      cell: (r) => (
        <Button variant="ghost" size="compact" onClick={() => setDetail(r)}>
          {t("actions.view")}
        </Button>
      ),
    },
  ];

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("nav.incidents")}>
        <Stack gap={4}>
          <PageHeader title={t("incidents.dashboardTitle")} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <StatCard label={t("incidents.openCount")} value={stats.open} tone="warning" />
            <StatCard label={t("incidents.underReviewCount")} value={stats.review} tone="info" />
            <StatCard label={t("incidents.criticalCount")} value={stats.critical} tone="error" />
            <StatCard label={t("incidents.thisMonth")} value={stats.thisMonth} tone="neutral" />
          </div>

          <Card padding="md">
            <Stack gap={3}>
              <FilterBar>
                <div style={{ width: 200 }}>
                  <FormField label={t("alerts.filterStatus")}>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
                      options={[
                        { value: "ALL", label: t("incidents.allStatuses") },
                        { value: "OPEN", label: t("incidents.status.OPEN") },
                        { value: "UNDER_REVIEW", label: t("incidents.status.UNDER_REVIEW") },
                        { value: "CLOSED", label: t("incidents.status.CLOSED") },
                      ]}
                    />
                  </FormField>
                </div>
                <div style={{ width: 220 }}>
                  <FormField label={t("incidents.typeLabel")}>
                    <Select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter((e.target as HTMLSelectElement).value)}
                      options={[
                        { value: "ALL", label: t("incidents.allTypes") },
                        ...TYPE_KEYS.map((k) => ({ value: k, label: t(`incidents.type.${k}`) })),
                      ]}
                    />
                  </FormField>
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <FormField label={t("actions.search")}>
                    <SearchField
                      placeholder={t("incidents.searchPlaceholder")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onClear={() => setSearch("")}
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
              ) : filtered.length === 0 ? (
                <EmptyState title={t("incidents.noIncidents")} />
              ) : (
                <Table<IncidentRow>
                  columns={columns}
                  rows={filtered}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => setDetail(r)}
                />
              )}
            </Stack>
          </Card>
        </Stack>

        {branchId && (
          <IncidentDetailDrawer
            open={!!detail}
            onClose={() => setDetail(null)}
            incident={detail}
            branchId={branchId}
            staffId={staff?.id ?? null}
            staffRole={staff?.role ?? null}
            logAction={logAction}
          />
        )}
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/incidents")({
  component: IncidentsDashboardPage,
});
