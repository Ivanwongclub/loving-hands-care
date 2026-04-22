import { useState } from "react";
import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit, KeyRound, Unlock, UserX, UserCheck, ClipboardCheck, Clock, Pill, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Card, Stack, Inline, Avatar, Badge, Button, Tabs, StatCard, Table, EmptyState,
  Spinner, Alert, Text, type Column,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import { EditStaffDrawer } from "@/components/staff/EditStaffDrawer";
import { SetPINModal } from "@/components/staff/SetPINModal";
import { UnlockPINModal } from "@/components/staff/UnlockPINModal";
import type { Tables, Enums } from "@/integrations/supabase/types";

type StaffRow = Tables<"staff">;
type StaffRoleEnum = Enums<"staff_role">;
type StaffStatusEnum = Enums<"staff_status">;

const ROLE_TONE: Record<StaffRoleEnum, "error" | "warning" | "info" | "success" | "neutral"> = {
  SYSTEM_ADMIN: "error",
  BRANCH_ADMIN: "warning",
  SENIOR_NURSE: "info",
  NURSE: "info",
  CAREGIVER: "success",
  DCU_WORKER: "success",
  FINANCE: "neutral",
  FAMILY: "neutral",
};

const STATUS_TONE: Record<StaffStatusEnum, "success" | "neutral" | "error"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "error",
};

const SEVERITY_TONE: Record<string, "error" | "warning" | "info" | "neutral"> = {
  CRITICAL: "error", HIGH: "error", MEDIUM: "warning", LOW: "info",
};

interface TaskItem {
  id: string;
  status: string;
  title: string;
  type: string;
  due_at: string;
  resident: { name_zh: string | null; name: string } | null;
}
interface EmarItem {
  id: string;
  status: string;
  administered_at: string | null;
  order: { drug_name: string; drug_name_zh: string | null; dose: string } | null;
  resident: { name_zh: string | null; name: string } | null;
}
interface IncidentItem {
  id: string;
  incident_ref: string;
  type: string;
  severity: string;
  status: string;
  occurred_at: string;
  resident: { name_zh: string | null; name: string } | null;
}

function StaffDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/staff/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { branches } = useBranches();
  const { staff: currentStaff } = useCurrentStaff();

  const canManage = currentStaff?.role === "SYSTEM_ADMIN" || currentStaff?.role === "BRANCH_ADMIN";

  const [tab, setTab] = useState<"tasks" | "emar" | "incidents">("tasks");
  const [editOpen, setEditOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();

  const staffQuery = useQuery({
    queryKey: ["staff-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff").select("*").eq("id", id).is("deleted_at", null).single();
      if (error) throw error;
      return data as StaffRow;
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["staff-tasks", id, cutoff],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, title, type, due_at, resident:resident_id(name_zh, name)")
        .eq("assigned_to", id)
        .gte("created_at", cutoff)
        .order("due_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TaskItem[];
    },
  });

  const emarQuery = useQuery({
    queryKey: ["staff-emar", id, cutoff],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emar_records")
        .select("id, status, administered_at, order:order_id(drug_name, drug_name_zh, dose), resident:resident_id(name_zh, name)")
        .eq("administered_by", id)
        .gte("administered_at", cutoff)
        .order("administered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmarItem[];
    },
  });

  const incidentsQuery = useQuery({
    queryKey: ["staff-incidents", id, cutoff],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id, incident_ref, type, severity, status, occurred_at, resident:resident_id(name_zh, name)")
        .eq("reporter_id", id)
        .gte("occurred_at", cutoff)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as IncidentItem[];
    },
  });

  const auditCountQuery = useQuery({
    queryKey: ["staff-audit-count", id, cutoff],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("actor_id", id)
        .gte("created_at", cutoff);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const refetchAll = () => {
    void staffQuery.refetch();
    void qc.invalidateQueries({ queryKey: ["staff"] });
  };

  const toggleActivation = useMutation({
    mutationFn: async (next: StaffStatusEnum) => {
      if (!staffQuery.data) throw new Error("No staff");
      const before = { status: staffQuery.data.status };
      const { error } = await supabase
        .from("staff").update({ status: next }).eq("id", id);
      if (error) throw error;
      await logAction({
        action: next === "ACTIVE" ? "STAFF_REACTIVATED" : "STAFF_DEACTIVATED",
        entity_type: "staff",
        entity_id: id,
        before_state: before as Record<string, unknown>,
        after_state: { status: next } as Record<string, unknown>,
      });
    },
    onSuccess: (_d, next) => {
      toast.success(t(next === "ACTIVE" ? "staff.reactivateSuccess" : "staff.deactivateSuccess"));
      refetchAll();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (staffQuery.isLoading) {
    return (
      <ProtectedRoute>
        <AdminDesktopShell pageTitle={t("staff.detail")}>
          <div className="grid place-items-center" style={{ minHeight: 400 }}>
            <Spinner size="lg" />
          </div>
        </AdminDesktopShell>
      </ProtectedRoute>
    );
  }

  if (staffQuery.error || !staffQuery.data) {
    return (
      <ProtectedRoute>
        <AdminDesktopShell pageTitle={t("staff.detail")}>
          <Stack gap={3}>
            <Alert severity="error" description={(staffQuery.error as Error)?.message ?? "Not found"} />
            <div>
              <Button variant="soft" leadingIcon={<ArrowLeft size={16} />} onClick={() => navigate({ to: "/staff" })}>
                {t("actions.back")}
              </Button>
            </div>
          </Stack>
        </AdminDesktopShell>
      </ProtectedRoute>
    );
  }

  const staff = staffQuery.data;
  const tasks = tasksQuery.data ?? [];
  const emar = emarQuery.data ?? [];
  const incidents = incidentsQuery.data ?? [];

  const tasksCompleted = tasks.filter((tk) => tk.status === "COMPLETED").length;
  const tasksPending = tasks.filter((tk) => tk.status === "PENDING" || tk.status === "IN_PROGRESS").length;

  const branchNameMap = new Map<string, string>();
  branches.forEach((b) => branchNameMap.set(b.id, b.name_zh || b.name));

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const taskColumns: Column<TaskItem>[] = [
    { key: "resident", header: t("staff.columns.resident"), cell: (r) => r.resident?.name_zh || r.resident?.name || "—" },
    {
      key: "task", header: t("staff.columns.task"),
      cell: (r) => (
        <Inline gap={2}>
          <span style={{ color: "var(--text-primary)" }}>{r.title}</span>
          <Badge tone="neutral">{r.type}</Badge>
        </Inline>
      ),
    },
    { key: "due", header: t("staff.columns.due"), width: 160, cell: (r) => formatDateTime(r.due_at) },
    {
      key: "status", header: t("residents.columns.status"), width: 120,
      cell: (r) => <Badge tone={r.status === "COMPLETED" ? "success" : r.status === "OVERDUE" ? "error" : "warning"}>{r.status}</Badge>,
    },
  ];

  const emarColumns: Column<EmarItem>[] = [
    { key: "resident", header: t("staff.columns.resident"), cell: (r) => r.resident?.name_zh || r.resident?.name || "—" },
    {
      key: "drug", header: t("staff.columns.drug"),
      cell: (r) => (
        <span style={{ color: "var(--text-primary)" }}>
          {(r.order?.drug_name_zh || r.order?.drug_name) ?? "—"} · {r.order?.dose ?? ""}
        </span>
      ),
    },
    { key: "time", header: t("staff.columns.time"), width: 180, cell: (r) => formatDateTime(r.administered_at) },
    { key: "status", header: t("residents.columns.status"), width: 120, cell: (r) => <Badge tone={r.status === "ADMINISTERED" ? "success" : r.status === "REFUSED" ? "warning" : "neutral"}>{r.status}</Badge> },
  ];

  const incidentColumns: Column<IncidentItem>[] = [
    { key: "ref", header: t("staff.columns.incidentRef"), width: 140, cell: (r) => <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--text-primary)" }}>{r.incident_ref}</span> },
    { key: "type", header: t("staff.columns.type"), cell: (r) => <Badge tone="neutral">{r.type}</Badge> },
    { key: "severity", header: t("staff.columns.severity"), width: 110, cell: (r) => <Badge tone={SEVERITY_TONE[r.severity] ?? "neutral"}>{r.severity}</Badge> },
    { key: "resident", header: t("staff.columns.resident"), cell: (r) => r.resident?.name_zh || r.resident?.name || "—" },
    { key: "time", header: t("staff.columns.time"), width: 180, cell: (r) => formatDateTime(r.occurred_at) },
    { key: "status", header: t("residents.columns.status"), width: 120, cell: (r) => <Badge tone={r.status === "CLOSED" ? "success" : "warning"}>{r.status}</Badge> },
  ];

  const isActive = staff.status === "ACTIVE";

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={staff.name_zh || staff.name}>
        <Stack gap={4}>
          <div>
            <Button variant="ghost" leadingIcon={<ArrowLeft size={16} />} onClick={() => navigate({ to: "/staff" })}>
              {t("actions.back")}
            </Button>
          </div>

          <Card padding="md">
            <Inline gap={4} align="start" justify="between" className="w-full">
              <Inline gap={4} align="start">
                <Avatar name={staff.name_zh || staff.name} size="lg" />
                <Stack gap={2}>
                  <Stack gap={1}>
                    <span className="type-h2" style={{ color: "var(--text-primary)" }}>{staff.name_zh || "—"}</span>
                    <Text size="md" color="secondary">{staff.name}</Text>
                  </Stack>
                  <Inline gap={2} wrap>
                    <Badge tone={ROLE_TONE[staff.role]}>{t(`staff.roles.${staff.role}`)}</Badge>
                    <Badge tone={STATUS_TONE[staff.status]}>{t(`staff.status.${staff.status}`)}</Badge>
                    {staff.pin_locked_at ? (
                      <Badge tone="error">{t("staff.pinLocked")}</Badge>
                    ) : staff.pin_hash ? (
                      <Badge tone="success">{t("staff.pinSet")}</Badge>
                    ) : (
                      <Badge tone="neutral">{t("staff.pinNotSet")}</Badge>
                    )}
                  </Inline>
                  <Inline gap={3}>
                    <Text size="sm" color="secondary">{t("staff.email")}: {staff.email}</Text>
                    {staff.phone && <Text size="sm" color="secondary">{t("staff.phone")}: {staff.phone}</Text>}
                  </Inline>
                  <Inline gap={1} wrap>
                    {staff.role === "SYSTEM_ADMIN" ? (
                      <Badge tone="info">{t("staff.branchesAll")}</Badge>
                    ) : (
                      (staff.branch_ids ?? []).map((bid) => (
                        <Badge key={bid} tone="neutral">{branchNameMap.get(bid) ?? bid.slice(0, 6)}</Badge>
                      ))
                    )}
                  </Inline>
                </Stack>
              </Inline>

              {canManage && (
                <Inline gap={2} wrap>
                  <Button variant="soft" leadingIcon={<Edit size={16} />} onClick={() => setEditOpen(true)}>
                    {t("actions.edit")}
                  </Button>
                  <Button variant="soft" leadingIcon={<KeyRound size={16} />} onClick={() => setPinOpen(true)}>
                    {staff.pin_hash ? t("staff.resetPin") : t("staff.setPin")}
                  </Button>
                  {staff.pin_locked_at && (
                    <Button variant="soft" leadingIcon={<Unlock size={16} />} onClick={() => setUnlockOpen(true)}>
                      {t("staff.unlockPin")}
                    </Button>
                  )}
                  {isActive ? (
                    <Button variant="ghost" leadingIcon={<UserX size={16} />} onClick={() => toggleActivation.mutate("INACTIVE")} loading={toggleActivation.isPending}>
                      {t("staff.deactivate")}
                    </Button>
                  ) : (
                    <Button variant="soft" leadingIcon={<UserCheck size={16} />} onClick={() => toggleActivation.mutate("ACTIVE")} loading={toggleActivation.isPending}>
                      {t("staff.reactivate")}
                    </Button>
                  )}
                </Inline>
              )}
            </Inline>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t("staff.tasksCompleted")} value={tasksCompleted} tone="success" icon={<ClipboardCheck size={18} />} />
            <StatCard label={t("staff.tasksPending")} value={tasksPending} tone="warning" icon={<Clock size={18} />} />
            <StatCard label={t("staff.emarAdministered")} value={emar.length} tone="info" icon={<Pill size={18} />} />
            <StatCard label={t("staff.incidentsReported")} value={incidents.length} tone="neutral" icon={<AlertTriangle size={18} />} />
          </div>

          <Inline gap={2}>
            <Text size="sm" color="tertiary">{t("staff.auditActivity")}: {auditCountQuery.data ?? 0} · {t("staff.last7days")}</Text>
          </Inline>

          <Tabs
            style="line"
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            items={[
              { value: "tasks", label: t("nav.careTasks") },
              { value: "emar", label: t("nav.emar") },
              { value: "incidents", label: t("nav.incidents") },
            ]}
          />

          {tab === "tasks" && (
            <Table<TaskItem>
              columns={taskColumns}
              rows={tasks}
              rowKey={(r) => r.id}
              empty={<EmptyState title={t("staff.noWorkload")} />}
            />
          )}
          {tab === "emar" && (
            <Table<EmarItem>
              columns={emarColumns}
              rows={emar}
              rowKey={(r) => r.id}
              empty={<EmptyState title={t("staff.noWorkload")} />}
            />
          )}
          {tab === "incidents" && (
            <Table<IncidentItem>
              columns={incidentColumns}
              rows={incidents}
              rowKey={(r) => r.id}
              empty={<EmptyState title={t("staff.noWorkload")} />}
            />
          )}
        </Stack>

        <EditStaffDrawer
          open={editOpen}
          onClose={() => { setEditOpen(false); refetchAll(); }}
          staffMember={staff}
          onOpenSetPIN={() => { setEditOpen(false); setPinOpen(true); }}
          onOpenUnlockPIN={() => { setEditOpen(false); setUnlockOpen(true); }}
        />
        <SetPINModal
          open={pinOpen}
          onClose={() => { setPinOpen(false); refetchAll(); }}
          staffMember={staff}
        />
        <UnlockPINModal
          open={unlockOpen}
          onClose={() => { setUnlockOpen(false); refetchAll(); }}
          staffMember={staff}
        />
        <Link to="/staff" style={{ display: "none" }}>.</Link>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/staff/$id")({
  component: StaffDetailPage,
});
