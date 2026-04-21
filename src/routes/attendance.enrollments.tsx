import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Inbox, Printer, RefreshCw, Edit } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  PageHeader, FilterBar, SearchField, Select, Table, Badge, Button, Avatar,
  Stack, Inline, Skeleton, EmptyState, DropdownMenu, ConfirmDialog,
  type Column,
} from "@/components/hms";
import { useBranches } from "@/hooks/useBranches";
import { useDCUEnrollments, type DCUEnrollment, type DCUEnrollmentStatus } from "@/hooks/useDCUEnrollments";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import { EnrollmentFormModal } from "@/components/dcu/EnrollmentFormModal";
import { EnrollmentEditDrawer } from "@/components/dcu/EnrollmentEditDrawer";
import { QRCardPrintModal } from "@/components/dcu/QRCardPrintModal";

const STATUS_TONE: Record<DCUEnrollmentStatus, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  DISCHARGED: "neutral",
};

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

function DCUEnrollmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { branches } = useBranches();
  const branch = branches[0] ?? null;
  const branchId = branch?.id ?? null;

  const [statusFilter, setStatusFilter] = useState<"ALL" | DCUEnrollmentStatus>("ALL");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DCUEnrollment | null>(null);
  const [printing, setPrinting] = useState<DCUEnrollment | null>(null);
  const [regenTarget, setRegenTarget] = useState<DCUEnrollment | null>(null);

  const { enrollments, isLoading } = useDCUEnrollments({ branchId, status: statusFilter });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((e) => {
      const r = e.residents;
      if (!r) return false;
      return (
        (r.name_zh ?? "").toLowerCase().includes(q) ||
        (r.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [enrollments, search]);

  const regenerateMutation = useMutation({
    mutationFn: async (target: DCUEnrollment) => {
      const newQR = crypto.randomUUID();
      const { data, error } = await supabase
        .from("dcu_enrollments")
        .update({ qr_code_uuid: newQR })
        .eq("id", target.id)
        .select("*")
        .single();
      if (error) throw error;
      await logAction({
        action: "DCU_QR_REGENERATED",
        entity_type: "dcu_enrollments",
        entity_id: target.id,
        branch_id: target.branch_id,
        before_state: { qr_code_uuid: target.qr_code_uuid },
        after_state: { qr_code_uuid: newQR },
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcuEnrollments", branchId] });
      toast.success(t("dcu.qrRegenerateSuccess"));
      setRegenTarget(null);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ row, next }: { row: DCUEnrollment; next: DCUEnrollmentStatus }) => {
      const { data, error } = await supabase
        .from("dcu_enrollments")
        .update({ status: next })
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw error;
      await logAction({
        action: "DCU_ENROLLMENT_UPDATED",
        entity_type: "dcu_enrollments",
        entity_id: row.id,
        branch_id: row.branch_id,
        before_state: { status: row.status },
        after_state: { status: next },
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcuEnrollments", branchId] });
      toast.success(t("branches.toastSaved"));
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const statusOptions: { value: "ALL" | DCUEnrollmentStatus; label: string }[] = [
    { value: "ALL", label: t("dcu.filters.allStatus") },
    { value: "ACTIVE", label: t("dcu.status.ACTIVE") },
    { value: "SUSPENDED", label: t("dcu.status.SUSPENDED") },
    { value: "DISCHARGED", label: t("dcu.status.DISCHARGED") },
  ];

  const columns: Column<DCUEnrollment>[] = [
    {
      key: "resident",
      header: t("residents.title"),
      cell: (row) => (
        <Inline gap={2}>
          <Avatar name={row.residents?.name_zh ?? row.residents?.name ?? "?"} size="sm" />
          <Stack gap={1}>
            <span className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>
              {row.residents?.name_zh ?? "—"}
            </span>
            <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>
              {row.residents?.name ?? ""}
            </span>
          </Stack>
        </Inline>
      ),
    },
    {
      key: "status",
      header: t("branches.columns.status"),
      width: 110,
      cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{t(`dcu.status.${row.status}`)}</Badge>,
    },
    {
      key: "start",
      header: t("dcu.startDate"),
      width: 130,
      cell: (row) => <span className="type-body-sm">{formatDate(row.start_date)}</span>,
    },
    {
      key: "end",
      header: t("dcu.endDate"),
      width: 130,
      cell: (row) => <span className="type-body-sm">{formatDate(row.end_date)}</span>,
    },
    {
      key: "days",
      header: t("dcu.daysPerWeek"),
      width: 110,
      cell: (row) => <span className="type-body-sm">{row.days_per_week ?? "—"}</span>,
    },
    {
      key: "qr",
      header: t("dcu.qrLabel"),
      width: 110,
      cell: () => <Badge tone="success">{t("dcu.qrActive")}</Badge>,
    },
    {
      key: "actions",
      header: "",
      width: 60,
      cell: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu
            trigger={
              <button
                type="button"
                aria-label="Row actions"
                className="p-1.5 rounded hover:bg-[var(--bg-hover-subtle)]"
              >
                <MoreHorizontal size={16} />
              </button>
            }
            items={[
              { label: <Inline gap={2}><Edit size={14} />{t("actions.edit")}</Inline>, onSelect: () => setEditing(row) },
              { label: <Inline gap={2}><Printer size={14} />{t("dcu.printQR")}</Inline>, onSelect: () => setPrinting(row) },
              { label: <Inline gap={2}><RefreshCw size={14} />{t("dcu.regenerateQR")}</Inline>, onSelect: () => setRegenTarget(row) },
              ...(row.status !== "SUSPENDED"
                ? [{ label: t("dcu.suspend"), onSelect: () => setStatusMutation.mutate({ row, next: "SUSPENDED" as DCUEnrollmentStatus }) }]
                : []),
              ...(row.status !== "DISCHARGED"
                ? [{ label: t("dcu.discharge"), onSelect: () => setStatusMutation.mutate({ row, next: "DISCHARGED" as DCUEnrollmentStatus }), tone: "destructive" as const }]
                : []),
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("dcu.enrollment")}>
        <PageHeader
          title={t("dcu.enrollments")}
          actions={
            <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
              {t("dcu.newEnrollment")}
            </Button>
          }
        />

        <FilterBar>
          <div style={{ width: 200 }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value as typeof statusFilter)}
              options={statusOptions}
            />
          </div>
          <div style={{ width: 280 }}>
            <SearchField
              placeholder={t("dcu.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
            />
          </div>
        </FilterBar>

        {isLoading ? (
          <Stack gap={2}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="row" height={56} />)}
          </Stack>
        ) : (
          <Table<DCUEnrollment>
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            onRowClick={(r) => setEditing(r)}
            empty={
              <EmptyState
                icon={<Inbox size={40} />}
                title={t("dcu.emptyList")}
              />
            }
          />
        )}

        <EnrollmentFormModal open={addOpen} onClose={() => setAddOpen(false)} branchId={branchId} />
        <EnrollmentEditDrawer
          open={!!editing}
          onClose={() => setEditing(null)}
          enrollment={editing}
          branchId={branchId}
        />
        <QRCardPrintModal
          open={!!printing}
          onClose={() => setPrinting(null)}
          enrollment={printing}
          branchName={branch?.name ?? ""}
          branchNameZh={branch?.name_zh ?? ""}
        />
        <ConfirmDialog
          open={!!regenTarget}
          onClose={() => setRegenTarget(null)}
          onConfirm={() => regenTarget && regenerateMutation.mutate(regenTarget)}
          title={t("dcu.regenerateQR")}
          summary={t("dcu.qrRegenerateConfirm")}
          confirmLabel={t("actions.confirm")}
          cancelLabel={t("actions.cancel")}
        />
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/attendance/enrollments")({
  component: DCUEnrollmentsPage,
});
