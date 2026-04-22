import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, Inbox } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import {
  PageHeader, FilterBar, Table, Badge, Button, StatCard, TextField,
  Stack, Inline, Skeleton, EmptyState, type Column,
} from "@/components/hms";
import { useBranches } from "@/hooks/useBranches";
import { useAttendanceSessions, type AttendanceSessionRow } from "@/hooks/useAttendanceSessions";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

const STATUS_TONE: Record<string, "success" | "error" | "warning" | "neutral"> = {
  PRESENT: "success",
  ABSENT: "error",
  PARTIAL: "warning",
  EXPECTED: "neutral",
};

function AttendanceRegisterPage() {
  const { t } = useTranslation();
  const { branches } = useBranches();
  const DEMO_BRANCH_ID = '10000000-0000-0000-0000-000000000001'; // DEMO ONLY — remove before production
  const branchId = branches.find(b => b.id === DEMO_BRANCH_ID)?.id ?? branches[0]?.id ?? null;

  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const { sessions, summary, isLoading } = useAttendanceSessions(branchId, dateFrom, dateTo);

  const formatDuration = useMemo(() => {
    return (mins: number | null) => {
      if (mins === null || mins === undefined) return "—";
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h} ${t("attendance.hours")} ${m} ${t("attendance.minutes")}`;
    };
  }, [t]);

  const columns: Column<AttendanceSessionRow>[] = [
    {
      key: "date",
      header: t("attendance.date"),
      width: 120,
      cell: (row) => <span className="type-body-sm">{row.session_date}</span>,
    },
    {
      key: "member",
      header: t("residents.title"),
      cell: (row) => {
        const r = row.dcu_enrollments?.residents ?? null;
        return (
          <Stack gap={1}>
            <span className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>
              {r?.name_zh ?? "—"}
            </span>
            <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>
              {r?.name ?? ""}
            </span>
          </Stack>
        );
      },
    },
    {
      key: "in",
      header: t("attendance.checkInTime"),
      width: 110,
      cell: (row) => <span className="type-body-sm font-mono">{formatTime(row.check_in_at)}</span>,
    },
    {
      key: "out",
      header: t("attendance.checkOutTime"),
      width: 110,
      cell: (row) => <span className="type-body-sm font-mono">{formatTime(row.check_out_at)}</span>,
    },
    {
      key: "duration",
      header: t("attendance.duration"),
      width: 140,
      cell: (row) => <span className="type-body-sm">{formatDuration(row.duration_minutes)}</span>,
    },
    {
      key: "status",
      header: t("branches.columns.status"),
      width: 110,
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>
          {t(`attendance.status.${row.status}`, { defaultValue: row.status })}
        </Badge>
      ),
    },
    {
      key: "manual",
      header: t("attendance.manualEntry"),
      width: 110,
      cell: (row) =>
        row.swd_flagged ? <Badge tone="warning">{t("attendance.manualEntry")}</Badge> : <span style={{ color: "var(--text-tertiary)" }}>—</span>,
    },
    {
      key: "notif",
      header: t("contacts.notifications"),
      width: 130,
      cell: () => <Badge tone="neutral">{t("attendance.notificationPending")}</Badge>,
    },
  ];

  const handleExportSWD = async () => {
    if (!branchId) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("swd-report-generate", {
        body: { branch_id: branchId, date_from: dateFrom, date_to: dateTo },
      });
      if (error) throw error;

      // data is a Blob from the Edge Function binary response
      const blob = new Blob([data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SWD_Attendance_${dateFrom}_${dateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("nav.attendance")}>
        <PageHeader
          title={t("attendance.register")}
          actions={
            <Button
              variant="soft"
              leadingIcon={<Download size={16} />}
              onClick={handleExportSWD}
              loading={exporting}
              disabled={exporting}
            >
              {t("attendance.exportSWD")}
            </Button>
          }
        />

        <FilterBar>
          <div style={{ width: 200 }}>
            <TextField type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div style={{ width: 200 }}>
            <TextField type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </FilterBar>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full" style={{ marginBottom: "var(--space-4)" }}>
          <StatCard label={t("attendance.summary.present")} value={summary.totalPresent} tone="success" />
          <StatCard label={t("attendance.summary.absent")} value={summary.totalAbsent} tone="error" />
          <StatCard label={t("attendance.summary.partial")} value={summary.totalPartial} tone="warning" />
        </div>

        {isLoading ? (
          <Stack gap={2}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="row" height={56} />)}
          </Stack>
        ) : (
          <Table<AttendanceSessionRow>
            columns={columns}
            rows={sessions}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={<Inbox size={40} />}
                title={t("attendance.noRecords")}
              />
            }
          />
        )}
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/attendance/register")({
  component: AttendanceRegisterPage,
});
