import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Users, Pill, AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Stack, Inline, Card, PageHeader, FormField, Select, DateField,
  Table, Badge, Button, EmptyState, Skeleton, Text, Alert, type Column,
} from "@/components/hms";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { supabase } from "@/integrations/supabase/client";

/* Helpers */
const pad = (n: number) => String(n).padStart(2, "0");
const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const hkidRef = (h?: string | null) => (h && h.length >= 4 ? h.slice(-4) : "—");
const onlyArr = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

/* Types for fetched rows (loose, since selects are dynamic) */
type ResidentLite = { id?: string; name_zh: string | null; name: string; hkid_hash: string | null } | null;
type StaffLite = { name: string; name_zh: string | null } | null;

interface AttRow {
  id: string;
  event_type: string;
  event_time: string;
  operator_type: string;
  is_manual: boolean;
  swd_flagged: boolean;
  resident: ResidentLite;
}
interface CensusRow {
  id: string;
  name_zh: string;
  name: string;
  status: string;
  admission_date: string | null;
  discharge_date: string | null;
  hkid_hash: string | null;
  bed: { code: string; name: string | null; name_zh: string | null } | null;
  icpStatus: string | null;
}
interface EmarRow {
  id: string;
  status: string;
  due_at: string;
  administered_at: string | null;
  barcode_verified: boolean;
  shift_pin_verified: boolean;
  resident: ResidentLite;
  order: { drug_name: string; drug_name_zh: string | null; dose: string } | null;
  administrator: StaffLite;
}
interface IncRow {
  id: string;
  incident_ref: string;
  type: string;
  severity: string;
  status: string;
  occurred_at: string;
  closed_at: string | null;
  resident: ResidentLite;
  followupCount: number;
}

/* Section wrapper */
function ReportSection({
  icon, title, desc, swdNote, summary, table, isLoading, hasFetched, rowCount, onExport,
  isExporting, errorMessage,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  swdNote: string;
  summary: React.ReactNode;
  table: React.ReactNode;
  isLoading: boolean;
  hasFetched: boolean;
  rowCount: number;
  onExport: () => void;
  isExporting: boolean;
  errorMessage?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <Card padding="md">
      <Stack gap={3}>
        <Inline justify="between" align="start">
          <Inline gap={3} align="start">
            <div
              className="grid place-items-center"
              style={{
                width: 40, height: 40, borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)",
              }}
            >
              {icon}
            </div>
            <Stack gap={1}>
              <Text size="lg" color="primary" style={{ fontWeight: 600 }}>{title}</Text>
              <Text size="sm" color="secondary">{desc}</Text>
            </Stack>
          </Inline>
          <Button
            variant="soft"
            size="compact"
            loading={isExporting}
            disabled={isExporting}
            onClick={onExport}
          >
            {isExporting ? t("reports.exporting") : t("reports.export")}
          </Button>
        </Inline>

        {errorMessage ? (
          <Alert severity="error" title={errorMessage} />
        ) : !hasFetched ? (
          <EmptyState icon={<Inbox size={36} />} title={t("reports.generate")} />
        ) : isLoading ? (
          <Stack gap={2}>
            <Skeleton variant="row" />
            <Skeleton variant="row" />
            <Skeleton variant="row" />
          </Stack>
        ) : rowCount === 0 ? (
          <EmptyState title={t("reports.noData")} />
        ) : (
          <Stack gap={3}>
            {summary}
            <Text size="sm" color="tertiary">{t("reports.rowCount", { count: rowCount })}</Text>
            {table}
          </Stack>
        )}

        <Text size="sm" color="tertiary">{swdNote}</Text>
      </Stack>
    </Card>
  );
}

function StatPill({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "neutral" | "success" | "warning" | "error" | "info" }) {
  const accent =
    tone === "success" ? "var(--status-success-accent)" :
    tone === "warning" ? "var(--status-warning-accent)" :
    tone === "error" ? "var(--status-error-accent)" :
    tone === "info" ? "var(--status-info-accent)" :
    "var(--text-secondary)";
  return (
    <div style={{ padding: "10px 14px", backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-sm)", minWidth: 140 }}>
      <div className="type-label" style={{ color: "var(--text-tertiary)" }}>{label}</div>
      <div className="type-body-md" style={{ color: accent, fontWeight: 600, fontSize: 18 }}>{value}</div>
    </div>
  );
}

/* Page */
function ReportsHubPage() {
  const { t } = useTranslation();
  const { branches } = useBranches();
  const { staff } = useCurrentStaff();

  const allowed = staff?.role === "SYSTEM_ADMIN" || staff?.role === "BRANCH_ADMIN";
  const isSystemAdmin = staff?.role === "SYSTEM_ADMIN";

  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(today());
  const [selectedBranch, setSelectedBranch] = useState<string>(branches[0]?.id ?? "");
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);
  const [lastPreviewTime, setLastPreviewTime] = useState<Date | null>(null);

  // When branches load, default-select first
  useMemo(() => {
    if (!selectedBranch && branches[0]?.id) setSelectedBranch(branches[0].id);
  }, [branches, selectedBranch]);

  const branchId = selectedBranch || branches[0]?.id || null;
  const enabled = hasFetched && !!branchId;

  /* DCU Attendance */
  const dcuQ = useQuery({
    queryKey: ["report-dcu", branchId, fromDate, toDate, fetchKey],
    enabled,
    queryFn: async (): Promise<AttRow[]> => {
      const { data, error } = await supabase
        .from("attendance_events")
        .select("id, event_type, event_time, operator_type, is_manual, dcu_enrollments:enrollment_id(residents:resident_id(id, name_zh, name, hkid_hash))")
        .eq("branch_id", branchId!)
        .gte("event_time", `${fromDate}T00:00:00`)
        .lte("event_time", `${toDate}T23:59:59`)
        .order("event_time", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const enr = onlyArr(r.dcu_enrollments as unknown) as { residents: ResidentLite | ResidentLite[] } | null;
        const res = enr ? (onlyArr(enr.residents as unknown) as ResidentLite) : null;
        return {
          id: r.id,
          event_type: r.event_type,
          event_time: r.event_time,
          operator_type: r.operator_type,
          is_manual: !!r.is_manual,
          swd_flagged: false,
          resident: res,
        };
      });
    },
  });

  /* Resident Census */
  const censusQ = useQuery({
    queryKey: ["report-census", branchId, toDate, fetchKey],
    enabled,
    queryFn: async (): Promise<CensusRow[]> => {
      const { data, error } = await supabase
        .from("residents")
        .select("id, name_zh, name, status, admission_date, discharge_date, hkid_hash, bed:bed_id(code, name, name_zh), icp:icps(status, created_at)")
        .eq("branch_id", branchId!)
        .lte("admission_date", toDate)
        .order("admission_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const icpArr = (r.icp as Array<{ status: string; created_at: string }> | null) ?? [];
        const sorted = [...icpArr].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        const latest = sorted[0]?.status ?? null;
        const bed = onlyArr(r.bed as unknown) as CensusRow["bed"];
        return {
          id: r.id,
          name_zh: r.name_zh,
          name: r.name,
          status: r.status,
          admission_date: r.admission_date,
          discharge_date: r.discharge_date,
          hkid_hash: r.hkid_hash,
          bed,
          icpStatus: latest,
        };
      });
    },
  });

  /* eMAR Compliance */
  const emarQ = useQuery({
    queryKey: ["report-emar", branchId, fromDate, toDate, fetchKey],
    enabled,
    queryFn: async (): Promise<EmarRow[]> => {
      const { data, error } = await supabase
        .from("emar_records")
        .select("id, status, due_at, administered_at, barcode_verified, shift_pin_verified, resident:resident_id(name_zh, name, hkid_hash), order:order_id(drug_name, drug_name_zh, dose), administrator:administered_by(name, name_zh)")
        .eq("branch_id", branchId!)
        .gte("due_at", `${fromDate}T00:00:00`)
        .lte("due_at", `${toDate}T23:59:59`)
        .order("due_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        due_at: r.due_at,
        administered_at: r.administered_at,
        barcode_verified: !!r.barcode_verified,
        shift_pin_verified: !!r.shift_pin_verified,
        resident: onlyArr(r.resident as unknown) as ResidentLite,
        order: onlyArr(r.order as unknown) as EmarRow["order"],
        administrator: onlyArr(r.administrator as unknown) as StaffLite,
      }));
    },
  });

  /* Incident Summary */
  const incQ = useQuery({
    queryKey: ["report-incidents", branchId, fromDate, toDate, fetchKey],
    enabled,
    queryFn: async (): Promise<IncRow[]> => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id, incident_ref, type, severity, status, occurred_at, closed_at, resident:resident_id(name_zh, name, hkid_hash), followups:incident_followups(id)")
        .eq("branch_id", branchId!)
        .gte("occurred_at", `${fromDate}T00:00:00`)
        .lte("occurred_at", `${toDate}T23:59:59`)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        incident_ref: r.incident_ref,
        type: r.type,
        severity: r.severity,
        status: r.status,
        occurred_at: r.occurred_at,
        closed_at: r.closed_at,
        resident: onlyArr(r.resident as unknown) as ResidentLite,
        followupCount: Array.isArray(r.followups) ? r.followups.length : 0,
      }));
    },
  });

  /* Stats */
  const dcuStats = useMemo(() => {
    const rows = dcuQ.data ?? [];
    const checkins = rows.filter((r) => r.event_type === "CHECK_IN");
    const unique = new Set(checkins.map((r) => r.resident?.id).filter(Boolean));
    const qrCount = rows.filter((r) => r.operator_type === "KIOSK").length;
    const manualCount = rows.filter((r) => r.is_manual || r.operator_type === "STAFF_MANUAL").length;
    return { total: checkins.length, unique: unique.size, qrCount, manualCount };
  }, [dcuQ.data]);

  const censusStats = useMemo(() => {
    const rows = censusQ.data ?? [];
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === "ADMITTED").length,
      discharged: rows.filter((r) => r.status === "DISCHARGED").length,
      activeICP: rows.filter((r) => r.icpStatus === "ACTIVE").length,
    };
  }, [censusQ.data]);

  const emarStats = useMemo(() => {
    const rows = emarQ.data ?? [];
    const administered = rows.filter((r) => r.status === "ADMINISTERED").length;
    const missed = rows.filter((r) => r.status === "MISSED").length;
    const refused = rows.filter((r) => r.status === "REFUSED").length;
    const late = rows.filter((r) => r.status === "LATE").length;
    const denom = administered + missed + refused + late;
    const rate = denom > 0 ? Math.round((administered / denom) * 100) : 0;
    return { administered, missed, refused, late, rate };
  }, [emarQ.data]);

  const incStats = useMemo(() => {
    const rows = incQ.data ?? [];
    const open = rows.filter((r) => r.status === "OPEN" || r.status === "UNDER_REVIEW").length;
    const critical = rows.filter((r) => r.severity === "CRITICAL").length;
    const closed = rows.filter((r) => r.closed_at && r.occurred_at);
    const avgDays = closed.length > 0
      ? Math.round(closed.reduce((sum, i) => sum + (new Date(i.closed_at!).getTime() - new Date(i.occurred_at).getTime()) / 86400000, 0) / closed.length)
      : null;
    return { total: rows.length, open, critical, avgDays };
  }, [incQ.data]);

  /* Columns */
  const dcuColumns: Column<AttRow>[] = [
    { key: "date", header: t("reports.dcuAttendance.sessionDate"), cell: (r) => fmtDate(r.event_time) },
    { key: "name", header: t("reports.dcuAttendance.residentName"), cell: (r) => r.resident?.name_zh || r.resident?.name || "—" },
    { key: "hkid", header: t("reports.dcuAttendance.hkidRef"), cell: (r) => <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{hkidRef(r.resident?.hkid_hash)}</span> },
    { key: "type", header: t("reports.dcuAttendance.type"), cell: (r) => <Badge tone={r.event_type === "CHECK_IN" ? "success" : "neutral"}>{r.event_type}</Badge> },
    { key: "time", header: t("reports.dcuAttendance.time"), cell: (r) => fmtDateTime(r.event_time) },
    { key: "src", header: t("reports.dcuAttendance.source"), cell: (r) => <Badge tone={r.is_manual ? "warning" : "info"}>{r.is_manual ? t("reports.dcuAttendance.manualSource") : t("reports.dcuAttendance.qrSource")}</Badge> },
  ];

  const censusColumns: Column<CensusRow>[] = [
    { key: "name", header: t("reports.residentCensus.residentName"), cell: (r) => r.name_zh || r.name },
    { key: "hkid", header: t("reports.residentCensus.hkidRef"), cell: (r) => <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{hkidRef(r.hkid_hash)}</span> },
    { key: "admit", header: t("reports.residentCensus.admittedAt"), cell: (r) => fmtDate(r.admission_date) },
    { key: "bed", header: t("reports.residentCensus.bedLocation"), cell: (r) => r.bed?.name_zh || r.bed?.name || r.bed?.code || "—" },
    { key: "status", header: t("reports.residentCensus.status"), cell: (r) => <Badge tone={r.status === "ADMITTED" ? "success" : "neutral"}>{r.status}</Badge> },
    { key: "icp", header: t("reports.residentCensus.icpStatus"), cell: (r) => r.icpStatus ? <Badge tone={r.icpStatus === "ACTIVE" ? "success" : "neutral"}>{r.icpStatus}</Badge> : <span style={{ color: "var(--text-tertiary)" }}>{t("reports.residentCensus.noICP")}</span> },
  ];

  const emarColumns: Column<EmarRow>[] = [
    { key: "res", header: t("reports.emarCompliance.residentName"), cell: (r) => r.resident?.name_zh || r.resident?.name || "—" },
    { key: "drug", header: t("reports.emarCompliance.drug"), cell: (r) => `${r.order?.drug_name_zh || r.order?.drug_name || "—"} ${r.order?.dose ?? ""}` },
    { key: "due", header: t("reports.emarCompliance.dueAt"), cell: (r) => fmtDateTime(r.due_at) },
    { key: "adm", header: t("reports.emarCompliance.administeredAt"), cell: (r) => fmtDateTime(r.administered_at) },
    { key: "by", header: t("reports.emarCompliance.administeredBy"), cell: (r) => r.administrator?.name_zh || r.administrator?.name || "—" },
    { key: "bc", header: t("reports.emarCompliance.barcodeVerified"), cell: (r) => r.barcode_verified ? <CheckCircle2 size={16} style={{ color: "var(--status-success-accent)" }} /> : <span style={{ color: "var(--text-tertiary)" }}>—</span> },
    { key: "pin", header: t("reports.emarCompliance.pinVerified"), cell: (r) => r.shift_pin_verified ? <CheckCircle2 size={16} style={{ color: "var(--status-success-accent)" }} /> : <span style={{ color: "var(--text-tertiary)" }}>—</span> },
    { key: "st", header: t("reports.emarCompliance.status"), cell: (r) => <Badge tone={r.status === "ADMINISTERED" ? "success" : r.status === "MISSED" ? "error" : "warning"}>{r.status}</Badge> },
  ];

  const incColumns: Column<IncRow>[] = [
    { key: "ref", header: t("reports.incidentSummary.incidentRef"), cell: (r) => <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{r.incident_ref}</span> },
    { key: "res", header: t("reports.incidentSummary.residentName"), cell: (r) => r.resident?.name_zh || r.resident?.name || "—" },
    { key: "type", header: t("reports.incidentSummary.type"), cell: (r) => <Badge tone="info">{r.type}</Badge> },
    { key: "sev", header: t("reports.incidentSummary.severity"), cell: (r) => <Badge tone={r.severity === "CRITICAL" || r.severity === "HIGH" ? "error" : r.severity === "MEDIUM" ? "warning" : "success"}>{r.severity}</Badge> },
    { key: "occ", header: t("reports.incidentSummary.occurredAt"), cell: (r) => fmtDateTime(r.occurred_at) },
    { key: "fu", header: t("reports.incidentSummary.followUpCount"), cell: (r) => r.followupCount },
    { key: "st", header: t("reports.incidentSummary.status"), cell: (r) => <Badge tone={r.status === "CLOSED" ? "neutral" : "warning"}>{r.status}</Badge> },
  ];

  const onPreview = () => {
    setHasFetched(true);
    setFetchKey((k) => k + 1);
    setLastPreviewTime(new Date());
  };

  type ReportType = "dcuAttendance" | "residentCensus" | "emarCompliance" | "incidentSummary";
  const TITLES: Record<ReportType, string> = {
    dcuAttendance: "日間護理出席記錄",
    residentCensus: "院友人口統計報表",
    emarCompliance: "電子用藥記錄合規報表",
    incidentSummary: "事故報告摘要",
  };

  const handleExport = async (reportType: ReportType) => {
    if (!branchId || !fromDate || !toDate) {
      toast.error(t("reports.exportError"));
      return;
    }
    setExporting(reportType);
    try {
      const { data, error } = await supabase.functions.invoke("report-generate", {
        body: {
          report_type: reportType,
          branch_id: branchId,
          from_date: fromDate,
          to_date: toDate,
        },
      });
      if (error) throw error;

      // supabase-js returns the raw body for unknown content types — coerce to ArrayBuffer
      let buf: ArrayBuffer;
      if (data instanceof ArrayBuffer) {
        buf = data;
      } else if (data instanceof Blob) {
        buf = await data.arrayBuffer();
      } else if (data instanceof Uint8Array) {
        buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      } else {
        throw new Error("Unexpected response payload");
      }

      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${TITLES[reportType]}_${fromDate}_${toDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("reports.exportSuccess"));
    } catch (err) {
      toast.error(`${t("reports.exportError")}: ${(err as Error).message}`);
    } finally {
      setExporting(null);
    }
  };

  if (!allowed) {
    return (
      <ProtectedRoute>
        <AdminDesktopShell pageTitle={t("reports.title")}>
          <Stack gap={4}>
            <PageHeader title={t("reports.title")} />
            <Card padding="md">
              <EmptyState icon={<Inbox size={48} />} title={t("audit.insufficientPermissions")} />
            </Card>
          </Stack>
        </AdminDesktopShell>
      </ProtectedRoute>
    );
  }

  const emarRateTone: "success" | "warning" | "error" =
    emarStats.rate >= 90 ? "success" : emarStats.rate >= 70 ? "warning" : "error";

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("reports.title")}>
        <Stack gap={4}>
          <PageHeader title={t("reports.title")} />

          <Card padding="md">
            <Stack gap={3}>
              <Text size="md" color="primary" style={{ fontWeight: 600 }}>{t("reports.dateRange")}</Text>
              <Inline gap={3} align="end" wrap>
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
                {isSystemAdmin && (
                  <div style={{ width: 240 }}>
                    <FormField label={t("reports.selectBranch")}>
                      <Select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch((e.target as HTMLSelectElement).value)}
                        options={branches.map((b) => ({ value: b.id, label: b.name_zh || b.name }))}
                      />
                    </FormField>
                  </div>
                )}
                <Button variant="primary" onClick={onPreview}>{t("reports.generate")}</Button>
              </Inline>
            </Stack>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* DCU Attendance */}
            <ReportSection
              icon={<Calendar size={20} />}
              title={t("reports.dcuAttendance.title")}
              desc={t("reports.dcuAttendance.desc")}
              swdNote={t("reports.dcuAttendance.swdNote")}
              isLoading={dcuQ.isLoading}
              hasFetched={hasFetched}
              rowCount={dcuQ.data?.length ?? 0}
              onExport={onExport}
              summary={
                <Inline gap={2} wrap>
                  <StatPill label={t("reports.dcuAttendance.totalCheckins")} value={dcuStats.total} tone="info" />
                  <StatPill label={t("reports.dcuAttendance.uniqueResidents")} value={dcuStats.unique} tone="success" />
                  <StatPill label={t("reports.dcuAttendance.qrSource")} value={dcuStats.qrCount} />
                  <StatPill label={t("reports.dcuAttendance.manualSource")} value={dcuStats.manualCount} tone="warning" />
                </Inline>
              }
              table={
                <Table<AttRow> columns={dcuColumns} rows={(dcuQ.data ?? []).slice(0, 15)} rowKey={(r) => r.id} density="compact" />
              }
            />

            {/* Resident Census */}
            <ReportSection
              icon={<Users size={20} />}
              title={t("reports.residentCensus.title")}
              desc={t("reports.residentCensus.desc")}
              swdNote={t("reports.residentCensus.swdNote")}
              isLoading={censusQ.isLoading}
              hasFetched={hasFetched}
              rowCount={censusQ.data?.length ?? 0}
              onExport={onExport}
              summary={
                <Inline gap={2} wrap>
                  <StatPill label={t("reports.residentCensus.totalResidents")} value={censusStats.total} tone="info" />
                  <StatPill label={t("reports.residentCensus.activeCount")} value={censusStats.active} tone="success" />
                  <StatPill label={t("reports.residentCensus.dischargedCount")} value={censusStats.discharged} />
                  <StatPill label={t("reports.residentCensus.activeICP")} value={censusStats.activeICP} tone="info" />
                </Inline>
              }
              table={
                <Table<CensusRow> columns={censusColumns} rows={(censusQ.data ?? []).slice(0, 15)} rowKey={(r) => r.id} density="compact" />
              }
            />

            {/* eMAR Compliance */}
            <ReportSection
              icon={<Pill size={20} />}
              title={t("reports.emarCompliance.title")}
              desc={t("reports.emarCompliance.desc")}
              swdNote={t("reports.emarCompliance.swdNote")}
              isLoading={emarQ.isLoading}
              hasFetched={hasFetched}
              rowCount={emarQ.data?.length ?? 0}
              onExport={onExport}
              summary={
                <Inline gap={2} wrap>
                  <StatPill label={t("reports.emarCompliance.complianceRate")} value={`${emarStats.rate}%`} tone={emarRateTone} />
                  <StatPill label={t("reports.emarCompliance.administered")} value={emarStats.administered} tone="success" />
                  <StatPill label={t("reports.emarCompliance.missed")} value={emarStats.missed} tone={emarStats.missed > 0 ? "error" : "neutral"} />
                  <StatPill label={t("reports.emarCompliance.refused")} value={emarStats.refused} tone="warning" />
                </Inline>
              }
              table={
                <Table<EmarRow> columns={emarColumns} rows={(emarQ.data ?? []).slice(0, 15)} rowKey={(r) => r.id} density="compact" />
              }
            />

            {/* Incident Summary */}
            <ReportSection
              icon={<AlertTriangle size={20} />}
              title={t("reports.incidentSummary.title")}
              desc={t("reports.incidentSummary.desc")}
              swdNote={t("reports.incidentSummary.swdNote")}
              isLoading={incQ.isLoading}
              hasFetched={hasFetched}
              rowCount={incQ.data?.length ?? 0}
              onExport={onExport}
              summary={
                <Inline gap={2} wrap>
                  <StatPill label={t("reports.incidentSummary.totalIncidents")} value={incStats.total} tone="info" />
                  <StatPill label={t("reports.incidentSummary.openCount")} value={incStats.open} tone="warning" />
                  <StatPill label={t("reports.incidentSummary.criticalCount")} value={incStats.critical} tone="error" />
                  <StatPill label={t("reports.incidentSummary.avgDaysToClose")} value={incStats.avgDays !== null ? `${incStats.avgDays} ${t("reports.incidentSummary.days")}` : "—"} />
                </Inline>
              }
              table={
                <Table<IncRow> columns={incColumns} rows={(incQ.data ?? []).slice(0, 15)} rowKey={(r) => r.id} density="compact" />
              }
            />
          </div>
        </Stack>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/reports")({
  component: ReportsHubPage,
});
