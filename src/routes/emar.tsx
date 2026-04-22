import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  PageHeader, FilterBar, StatCard, Card, Stack, Inline, Text, Badge, Button,
  EmptyState, FormField, TextField, SearchField, Select, Alert,
} from "@/components/hms";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import type { Tables, Enums } from "@/integrations/supabase/types";

export const Route = createFileRoute("/emar")({
  component: EMARDashboardPage,
});

type EMARStatus = Enums<"emar_status">;

type EMARDashboardRow = Tables<"emar_records"> & {
  order: { drug_name: string; drug_name_zh: string | null; dose: string; is_prn: boolean } | null;
  residents: { id: string; name: string; name_zh: string } | null;
};

const STATUS_TONE: Record<EMARStatus, "warning" | "success" | "error" | "neutral"> = {
  DUE: "warning",
  ADMINISTERED: "success",
  REFUSED: "neutral",
  HELD: "neutral",
  LATE: "error",
  MISSED: "error",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function formatTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

function EMARDashboardPage() {
  const { t } = useTranslation();
  const { staff } = useCurrentStaff();
  const branchId = staff?.branch_ids?.[0] ?? null;

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("emar.dashboardTitle")}>
        {branchId ? (
          <DashboardBody branchId={branchId} />
        ) : (
          <Card padding="lg">
            <EmptyState title={t("common.loading")} />
          </Card>
        )}
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

function DashboardBody({ branchId }: { branchId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [date, setDate] = useState<string>(todayISO());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const isToday = date === todayISO();

  // Silent MISSED/LATE flagging on mount + alert auto-creation (today only)
  useEffect(() => {
    if (!isToday) return;
    const today = todayISO();
    const nowIso = new Date().toISOString();

    const run = async () => {
      // MISSED: prior-day DUE records
      await supabase
        .from("emar_records")
        .update({ status: "MISSED" })
        .eq("branch_id", branchId)
        .eq("status", "DUE")
        .lt("due_at", `${today}T00:00:00`);

      // LATE: today's overdue DUE records
      await supabase
        .from("emar_records")
        .update({ status: "LATE" })
        .eq("branch_id", branchId)
        .eq("status", "DUE")
        .lt("due_at", nowIso)
        .gte("due_at", `${today}T00:00:00`);

      // Auto-create alerts for newly missed records without an existing alert
      const { data: missedRecords } = await supabase
        .from("emar_records")
        .select("id, resident_id, order_id, due_at")
        .eq("branch_id", branchId)
        .eq("status", "MISSED")
        .eq("alert_triggered", false);

      for (const record of missedRecords ?? []) {
        const { error: alertErr } = await supabase.from("alerts").insert({
          branch_id: branchId,
          resident_id: record.resident_id,
          source: "SYSTEM",
          source_ref_id: record.id,
          source_ref_table: "emar_records",
          type: "EMAR_MISSED",
          severity: "MEDIUM",
          status: "OPEN",
          triggered_at: new Date().toISOString(),
        });
        if (!alertErr) {
          await supabase
            .from("emar_records")
            .update({ alert_triggered: true })
            .eq("id", record.id);
        }
      }

      void qc.invalidateQueries({ queryKey: ["emarDashboard", branchId] });
      void qc.invalidateQueries({ queryKey: ["alerts"] });
    };
    void run();
  }, [branchId, isToday, qc]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["emarDashboard", branchId, date],
    enabled: !!branchId,
    queryFn: async (): Promise<EMARDashboardRow[]> => {
      const { data, error } = await supabase
        .from("emar_records")
        .select(
          "*, order:order_id(drug_name, drug_name_zh, dose, is_prn), residents:resident_id(id, name, name_zh)",
        )
        .eq("branch_id", branchId)
        .gte("due_at", `${date}T00:00:00`)
        .lte("due_at", `${date}T23:59:59`)
        .order("due_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EMARDashboardRow[];
    },
  });

  const counts = useMemo(() => {
    const c = { DUE: 0, ADMINISTERED: 0, REFUSED: 0, HELD: 0, LATE: 0, MISSED: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const compliance = useMemo(() => {
    const denom = counts.ADMINISTERED + counts.REFUSED + counts.MISSED + counts.LATE;
    if (denom === 0) return 0;
    return Math.round((counts.ADMINISTERED / denom) * 100);
  }, [counts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      const drug = (r.order?.drug_name_zh ?? "") + " " + (r.order?.drug_name ?? "");
      const res = (r.residents?.name_zh ?? "") + " " + (r.residents?.name ?? "");
      return drug.toLowerCase().includes(q) || res.toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter]);

  return (
    <Stack gap={4}>
      <PageHeader
        title={t("emar.dashboardTitle")}
        actions={
          <div style={{ width: 180 }}>
            <FormField label={t("emar.selectDate")}>
              <TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          </div>
        }
      />

      {counts.MISSED > 0 && (
        <Alert
          severity="warning"
          description={t("emar.missedAlert", { count: counts.MISSED })}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
        <StatCard label={t("emar.dueCount")} value={counts.DUE} tone="warning" />
        <StatCard label={t("emar.lateCount")} value={counts.LATE} tone="error" />
        <StatCard label={t("emar.administeredCount")} value={counts.ADMINISTERED} tone="success" />
        <StatCard label={t("emar.missedCount")} value={counts.MISSED} tone="error" />
        <StatCard label={t("emar.refusedCount")} value={counts.REFUSED} tone="neutral" />
      </div>

      <Card padding="md">
        <Stack gap={2}>
          <Inline justify="between" align="center" className="w-full">
            <Text size="sm" color="secondary">{t("emar.complianceRate")}</Text>
            <Text size="md" className="font-semibold">{compliance}%</Text>
          </Inline>
          <div
            style={{
              width: "100%",
              height: 8,
              backgroundColor: "var(--status-success-bg)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${compliance}%`,
                height: "100%",
                backgroundColor: "var(--status-success-accent)",
                transition: "width 240ms ease",
              }}
            />
          </div>
        </Stack>
      </Card>

      <FilterBar>
        <div style={{ minWidth: 280, flex: 1 }}>
          <SearchField
            placeholder={t("emar.filterByDrug")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
        <div style={{ minWidth: 180 }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "ALL", label: t("emar.allResidents") },
              { value: "DUE", label: t("emar.emarStatus.DUE") },
              { value: "LATE", label: t("emar.emarStatus.LATE") },
              { value: "ADMINISTERED", label: t("emar.emarStatus.ADMINISTERED") },
              { value: "MISSED", label: t("emar.emarStatus.MISSED") },
              { value: "REFUSED", label: t("emar.emarStatus.REFUSED") },
              { value: "HELD", label: t("emar.emarStatus.HELD") },
            ]}
          />
        </div>
      </FilterBar>

      <Card padding="none">
        {isLoading ? (
          <div className="p-4">
            <Stack gap={2}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </Stack>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title={t("emar.noEMARToday")} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("residents.columns.name")}</TableHead>
                <TableHead>{t("emar.drug")}</TableHead>
                <TableHead>{t("attendance.checkInTime")}</TableHead>
                <TableHead>{t("residents.columns.status")}</TableHead>
                <TableHead>{t("emar.dualVerification")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const rid = r.residents?.id ?? r.resident_id;
                const isLate = r.status === "LATE" || r.status === "MISSED";
                const dualVerified = r.barcode_verified && r.shift_pin_verified;
                const pinOnly = !r.barcode_verified && r.shift_pin_verified;
                return (
                  <TableRow
                    key={r.id}
                    onClick={() => navigate({ to: "/residents/$id", params: { id: rid } })}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <Stack gap={0}>
                        <Text size="sm" className="font-semibold">
                          {r.residents?.name_zh ?? "—"}
                        </Text>
                        <Text size="sm" color="tertiary">{r.residents?.name ?? ""}</Text>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Inline gap={2} align="center" wrap>
                        <Text size="sm">
                          {r.order?.drug_name_zh ?? r.order?.drug_name ?? "—"}
                        </Text>
                        {r.order?.dose && <Badge tone="neutral">{r.order.dose}</Badge>}
                        {r.order?.is_prn && <Badge tone="warning" emphasis="strong">PRN</Badge>}
                      </Inline>
                    </TableCell>
                    <TableCell>
                      <Text
                        size="sm"
                        style={{ color: isLate ? "var(--status-error-accent)" : undefined }}
                      >
                        {formatTime(r.due_at)}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[r.status]}>
                        {t(`emar.emarStatus.${r.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dualVerified ? (
                        <Inline gap={1} align="center">
                          <Shield size={14} style={{ color: "var(--status-success-accent)" }} />
                          <Text size="sm" color="secondary">{t("emar.pinVerified")}</Text>
                        </Inline>
                      ) : pinOnly ? (
                        <Inline gap={1} align="center">
                          <Shield size={14} style={{ color: "var(--text-tertiary)" }} />
                          <Text size="sm" color="tertiary">PIN</Text>
                        </Inline>
                      ) : (
                        <Text size="sm" color="tertiary">—</Text>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="compact"
                        onClick={() => navigate({ to: "/residents/$id", params: { id: rid } })}
                      >
                        {t("residents.bedDrawer.viewResident")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
