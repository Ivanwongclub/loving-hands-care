import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Inbox, Edit, KeyRound, Unlock, UserX, UserCheck, Eye } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  PageHeader, FilterBar, SearchField, Select, Table, Badge, Button, Avatar,
  Stack, Inline, Skeleton, EmptyState, DropdownMenu,
  type Column,
} from "@/components/hms";
import { useBranches } from "@/hooks/useBranches";
import { useStaff, type StaffRow, type StaffRoleEnum, type StaffStatusEnum } from "@/hooks/useStaff";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import { NewStaffModal } from "@/components/staff/NewStaffModal";
import { EditStaffDrawer } from "@/components/staff/EditStaffDrawer";
import { SetPINModal } from "@/components/staff/SetPINModal";
import { UnlockPINModal } from "@/components/staff/UnlockPINModal";

const ROLES: StaffRoleEnum[] = [
  "SYSTEM_ADMIN", "BRANCH_ADMIN", "SENIOR_NURSE", "NURSE",
  "CAREGIVER", "DCU_WORKER", "FINANCE", "FAMILY",
];
const STATUSES: StaffStatusEnum[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

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

function StaffManagementPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { logAction } = useAuditLog();
  const { branches } = useBranches();
  const DEMO_BRANCH_ID = '10000000-0000-0000-0000-000000000001'; // DEMO ONLY — remove before production
  const defaultBranchId = branches.find(b => b.id === DEMO_BRANCH_ID)?.id ?? branches[0]?.id ?? null;
  const { staff: currentStaff } = useCurrentStaff();

  const canCreate = currentStaff?.role === "SYSTEM_ADMIN" || currentStaff?.role === "BRANCH_ADMIN";
  const canManage = canCreate;
  const isSystemAdmin = currentStaff?.role === "SYSTEM_ADMIN";

  const [roleFilter, setRoleFilter] = useState<StaffRoleEnum | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<StaffStatusEnum | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(defaultBranchId);

  useEffect(() => {
    if (selectedBranchId === null && defaultBranchId && !isSystemAdmin) {
      setSelectedBranchId(defaultBranchId);
    }
  }, [defaultBranchId, isSystemAdmin, selectedBranchId]);

  const [newOpen, setNewOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [pinStaff, setPinStaff] = useState<StaffRow | null>(null);
  const [unlockStaff, setUnlockStaff] = useState<StaffRow | null>(null);

  const { staff, isLoading } = useStaff({
    branchId: selectedBranchId,
    role: roleFilter,
    status: statusFilter,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      (s.name_zh ?? "").toLowerCase().includes(q) ||
      (s.name ?? "").toLowerCase().includes(q),
    );
  }, [staff, search]);

  const branchNameMap = useMemo(() => {
    const m = new Map<string, string>();
    branches.forEach((b) => m.set(b.id, b.name_zh || b.name));
    return m;
  }, [branches]);

  const toggleActivation = useMutation({
    mutationFn: async ({ row, next }: { row: StaffRow; next: StaffStatusEnum }) => {
      const { data, error } = await supabase
        .from("staff").update({ status: next }).eq("id", row.id).select("*").single();
      if (error) throw error;
      await logAction({
        action: next === "ACTIVE" ? "STAFF_REACTIVATED" : "STAFF_DEACTIVATED",
        entity_type: "staff",
        entity_id: row.id,
        before_state: { status: row.status } as Record<string, unknown>,
        after_state: { status: next } as Record<string, unknown>,
      });
      return data;
    },
    onSuccess: (_d, { next }) => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t(next === "ACTIVE" ? "staff.reactivateSuccess" : "staff.deactivateSuccess"));
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const roleOptions = [
    { value: "ALL", label: t("staff.filterAllRoles") },
    ...ROLES.map((r) => ({ value: r, label: t(`staff.roles.${r}`) })),
  ];
  const statusOptions = [
    { value: "ALL", label: t("staff.filterAllStatus") },
    ...STATUSES.map((s) => ({ value: s, label: t(`staff.status.${s}`) })),
  ];

  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      header: t("residents.columns.name"),
      cell: (row) => (
        <Inline gap={2}>
          <Avatar name={row.name_zh || row.name} size="sm" />
          <Stack gap={1}>
            <span className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>
              {row.name_zh || "—"}
            </span>
            <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>
              {row.name}
            </span>
          </Stack>
        </Inline>
      ),
    },
    {
      key: "role",
      header: t("staff.role"),
      width: 130,
      cell: (row) => <Badge tone={ROLE_TONE[row.role]}>{t(`staff.roles.${row.role}`)}</Badge>,
    },
    {
      key: "branches",
      header: t("staff.branchAccess"),
      cell: (row) => {
        if (row.role === "SYSTEM_ADMIN") {
          return <Badge tone="info">{t("staff.branchesAll")}</Badge>;
        }
        if (!row.branch_ids || row.branch_ids.length === 0) {
          return <span className="type-body-sm" style={{ color: "var(--text-tertiary)" }}>—</span>;
        }
        return (
          <Inline gap={1} wrap>
            {row.branch_ids.map((id) => (
              <Badge key={id} tone="neutral">{branchNameMap.get(id) ?? id.slice(0, 6)}</Badge>
            ))}
          </Inline>
        );
      },
    },
    {
      key: "status",
      header: t("residents.columns.status"),
      width: 100,
      cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{t(`staff.status.${row.status}`)}</Badge>,
    },
    {
      key: "pin",
      header: "PIN",
      width: 110,
      cell: (row) => {
        if (row.pin_locked_at) return <Badge tone="error">{t("staff.pinLocked")}</Badge>;
        if (row.pin_hash) return <Badge tone="success">{t("staff.pinSet")}</Badge>;
        return <Badge tone="neutral">{t("staff.pinNotSet")}</Badge>;
      },
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
              { label: <Inline gap={2}><Eye size={14} />{t("staff.viewDetail")}</Inline>, onSelect: () => navigate({ to: "/staff/$id", params: { id: row.id } }) },
              { label: <Inline gap={2}><Edit size={14} />{t("actions.edit")}</Inline>, onSelect: () => setEditingStaff(row) },
              ...(canManage ? [{
                label: <Inline gap={2}><KeyRound size={14} />{row.pin_hash ? t("staff.resetPin") : t("staff.setPin")}</Inline>,
                onSelect: () => setPinStaff(row),
              }] : []),
              ...(canManage && row.pin_locked_at ? [{
                label: <Inline gap={2}><Unlock size={14} />{t("staff.unlockPin")}</Inline>,
                onSelect: () => setUnlockStaff(row),
              }] : []),
              ...(canManage ? [
                row.status === "ACTIVE"
                  ? {
                      label: <Inline gap={2}><UserX size={14} />{t("staff.deactivate")}</Inline>,
                      onSelect: () => toggleActivation.mutate({ row, next: "INACTIVE" as StaffStatusEnum }),
                      tone: "destructive" as const,
                    }
                  : {
                      label: <Inline gap={2}><UserCheck size={14} />{t("staff.reactivate")}</Inline>,
                      onSelect: () => toggleActivation.mutate({ row, next: "ACTIVE" as StaffStatusEnum }),
                    },
              ] : []),
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("staff.title")}>
        <PageHeader
          title={t("staff.title")}
          actions={
            canCreate ? (
              <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => setNewOpen(true)}>
                {t("staff.new")}
              </Button>
            ) : null
          }
        />

        <FilterBar>
          <div style={{ width: 280 }}>
            <SearchField
              placeholder={t("staff.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
            />
          </div>
          {isSystemAdmin && branches.length > 1 && (
            <div style={{ width: 240 }}>
              <Select
                value={selectedBranchId ?? ""}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  setSelectedBranchId(v || null);
                }}
                options={[
                  { value: "", label: t("staff.branchesAll") },
                  ...branches.map((b) => ({ value: b.id, label: b.name_zh || b.name })),
                ]}
              />
            </div>
          )}
          <div style={{ width: 200 }}>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter((e.target as HTMLSelectElement).value as typeof roleFilter)}
              options={roleOptions}
            />
          </div>
          <div style={{ width: 180 }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value as typeof statusFilter)}
              options={statusOptions}
            />
          </div>
        </FilterBar>

        {isLoading ? (
          <Stack gap={2}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="row" height={56} />)}
          </Stack>
        ) : (
          <Table<StaffRow>
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate({ to: "/staff/$id", params: { id: r.id } })}
            empty={
              <EmptyState
                icon={<Inbox size={40} />}
                title={t("staff.noStaff")}
              />
            }
          />
        )}

        <NewStaffModal open={newOpen} onClose={() => setNewOpen(false)} />
        <EditStaffDrawer
          open={!!editingStaff}
          onClose={() => setEditingStaff(null)}
          staffMember={editingStaff}
          onOpenSetPIN={(s) => { setEditingStaff(null); setPinStaff(s); }}
          onOpenUnlockPIN={(s) => { setEditingStaff(null); setUnlockStaff(s); }}
        />
        <SetPINModal
          open={!!pinStaff}
          onClose={() => setPinStaff(null)}
          staffMember={pinStaff}
        />
        <UnlockPINModal
          open={!!unlockStaff}
          onClose={() => setUnlockStaff(null)}
          staffMember={unlockStaff}
        />
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/staff")({
  component: StaffManagementPage,
});
