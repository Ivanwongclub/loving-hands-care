import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Plus, Copy, Eye } from "lucide-react";
import {
  PageHeader, FilterBar, SearchField, Select, Table, Badge, Button, EmptyState, Avatar,
  Stack, Inline, Skeleton, Surface, Modal, Drawer, FormField, TextField, PasswordField,
  Switch, Checkbox, Alert, ConfirmDialog, StatusDot, Label, Card,
  type Column,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useBranches, type Branch } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import {
  useStaff,
  useInviteStaff,
  useUpdateStaff,
  useDeactivateStaff,
  useAdminPinAction,
  type StaffRow,
  type StaffRoleEnum,
  type StaffStatusEnum,
} from "@/hooks/useStaff";

const ALL_ROLES: StaffRoleEnum[] = [
  "SYSTEM_ADMIN", "BRANCH_ADMIN", "SENIOR_NURSE", "NURSE",
  "CAREGIVER", "DCU_WORKER", "FINANCE", "FAMILY",
];

const ROLE_TONE: Record<StaffRoleEnum, "error" | "warning" | "info" | "neutral" | "success"> = {
  SYSTEM_ADMIN: "error",
  BRANCH_ADMIN: "warning",
  SENIOR_NURSE: "info",
  NURSE: "info",
  CAREGIVER: "neutral",
  DCU_WORKER: "neutral",
  FINANCE: "neutral",
  FAMILY: "neutral",
};

const STATUS_TONE: Record<StaffStatusEnum, "success" | "neutral" | "error"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "error",
};

function roleLabel(t: (k: string) => string, role: StaffRoleEnum) {
  return t(`staff.roles.${role}`);
}

function rolesAvailableTo(callerRole: StaffRoleEnum | undefined): StaffRoleEnum[] {
  if (callerRole === "SYSTEM_ADMIN") return ALL_ROLES;
  // BRANCH_ADMIN: cannot assign SYSTEM_ADMIN or BRANCH_ADMIN
  return ALL_ROLES.filter((r) => r !== "SYSTEM_ADMIN" && r !== "BRANCH_ADMIN");
}

export function StaffSection() {
  const { t } = useTranslation();
  const { staff: caller } = useCurrentStaff();
  const { staff: allStaff, isLoading } = useStaff();
  const { branches } = useBranches();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | StaffRoleEnum>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | StaffStatusEnum>("ALL");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [detail, setDetail] = useState<StaffRow | null>(null);

  const isSysAdmin = caller?.role === "SYSTEM_ADMIN";
  const isBranchAdmin = caller?.role === "BRANCH_ADMIN";
  const canManage = isSysAdmin || isBranchAdmin;

  // BRANCH_ADMIN scoping
  const scopedStaff = useMemo(() => {
    if (!caller) return [];
    if (caller.role === "SYSTEM_ADMIN") return allStaff;
    const myBranches = new Set(caller.branch_ids ?? []);
    return allStaff.filter((s) => (s.branch_ids ?? []).some((b) => myBranches.has(b)));
  }, [allStaff, caller]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedStaff.filter((s) => {
      if (roleFilter !== "ALL" && s.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.name_zh ?? "").toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [scopedStaff, search, roleFilter, statusFilter]);

  const branchNameMap = useMemo(() => {
    const m = new Map<string, string>();
    branches.forEach((b) => m.set(b.id, b.name_zh));
    return m;
  }, [branches]);

  const roleOptions = [
    { value: "ALL", label: t("staff.allRoles") },
    ...ALL_ROLES.map((r) => ({ value: r, label: roleLabel(t, r) })),
  ];
  const statusOptions = [
    { value: "ALL", label: t("staff.allStatuses") },
    { value: "ACTIVE", label: t("staff.status.ACTIVE") },
    { value: "INACTIVE", label: t("staff.status.INACTIVE") },
    { value: "SUSPENDED", label: t("staff.status.SUSPENDED") },
  ];

  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      header: t("staff.columns.name"),
      cell: (row) => (
        <Stack gap={1}>
          <span className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>
            {row.name_zh ?? row.name}
          </span>
          <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>{row.name}</span>
        </Stack>
      ),
    },
    {
      key: "role",
      header: t("staff.columns.role"),
      width: 140,
      cell: (row) => <Badge tone={ROLE_TONE[row.role]}>{roleLabel(t, row.role)}</Badge>,
    },
    {
      key: "type",
      header: t("staff.columns.type"),
      width: 110,
      cell: (row) =>
        row.is_shared_device ? <Badge tone="warning">{t("settings.staff.sharedDevice")}</Badge> : null,
    },
    {
      key: "branches",
      header: t("staff.columns.branches"),
      cell: (row) => (
        <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>
          {(row.branch_ids ?? [])
            .map((id) => branchNameMap.get(id) ?? id.slice(0, 6))
            .join("、")}
        </span>
      ),
    },
    {
      key: "status",
      header: t("staff.columns.status"),
      width: 100,
      cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{t(`staff.status.${row.status}`)}</Badge>,
    },
    {
      key: "pin",
      header: t("settings.staff.pinStatus"),
      width: 90,
      cell: (row) => {
        if (row.is_shared_device) return <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>—</span>;
        if (row.pin_locked_at) return <StatusDot tone="error" />;
        if (!row.pin_hash) return <StatusDot tone="warning" />;
        return <StatusDot tone="success" />;
      },
    },
    {
      key: "actions",
      header: "",
      width: 80,
      cell: (row) => (
        <Button
          variant="ghost"
          size="compact"
          leadingIcon={<Eye size={14} />}
          onClick={(e) => { e.stopPropagation(); setDetail(row); }}
        >
          {t("actions.view")}
        </Button>
      ),
    },
  ];

  return (
    <Stack gap={4}>
      <PageHeader
        title={t("settings.sections.staff")}
        actions={
          canManage ? (
            <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => setInviteOpen(true)}>
              {t("settings.staff.inviteButton")}
            </Button>
          ) : undefined
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
        <div style={{ width: 180 }}>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter((e.target as HTMLSelectElement).value as typeof roleFilter)}
            options={roleOptions}
          />
        </div>
        <div style={{ width: 160 }}>
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
          rowKey={(s) => s.id}
          onRowClick={(s) => setDetail(s)}
          empty={<EmptyState title={t("staff.emptyTitle")} description={t("staff.emptyDescription")} />}
        />
      )}

      <InviteStaffModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        callerRole={caller?.role}
        callerBranchIds={caller?.branch_ids ?? []}
        branches={branches}
      />
      <StaffDetailDrawer
        staff={detail}
        onClose={() => setDetail(null)}
        callerRole={caller?.role}
        callerBranchIds={caller?.branch_ids ?? []}
        branches={branches}
      />
    </Stack>
  );
}

/* ─────────────────── Invite Modal ─────────────────── */

interface InviteStaffModalProps {
  open: boolean;
  onClose: () => void;
  callerRole: StaffRoleEnum | undefined;
  callerBranchIds: string[];
  branches: Branch[];
}

function genTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
  return out;
}

function InviteStaffModal({ open, onClose, callerRole, callerBranchIds, branches }: InviteStaffModalProps) {
  const { t } = useTranslation();
  const inviteMut = useInviteStaff();
  const availableRoles = rolesAvailableTo(callerRole);

  const visibleBranches = useMemo(() => {
    if (callerRole === "SYSTEM_ADMIN") return branches;
    const set = new Set(callerBranchIds);
    return branches.filter((b) => set.has(b.id));
  }, [branches, callerRole, callerBranchIds]);

  const [name, setName] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRoleEnum>(availableRoles[0] ?? "NURSE");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [isShared, setIsShared] = useState(false);
  const [tempPassword, setTempPassword] = useState(genTempPassword());
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(""); setNameZh(""); setEmail("");
      setRole(availableRoles[0] ?? "NURSE");
      setSelectedBranches(callerRole === "BRANCH_ADMIN" ? [...callerBranchIds] : []);
      setIsShared(false);
      setTempPassword(genTempPassword());
      setErrMsg(null);
      setCreatedPassword(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared device locks role to NURSE and limit to 1 branch
  useEffect(() => {
    if (isShared) {
      setRole("NURSE");
      setSelectedBranches((prev) => prev.slice(0, 1));
    }
  }, [isShared]);

  const branchAdminLocked = callerRole === "BRANCH_ADMIN";

  const toggleBranch = (id: string, checked: boolean) => {
    if (branchAdminLocked) return;
    setSelectedBranches((prev) => {
      if (checked) {
        if (isShared) return [id]; // only one allowed
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    name.trim() &&
    nameZh.trim() &&
    validEmail &&
    selectedBranches.length > 0 &&
    tempPassword.length >= 8 &&
    !inviteMut.isPending;

  const onSubmit = async () => {
    setErrMsg(null);
    try {
      await inviteMut.mutateAsync({
        name: name.trim(),
        name_zh: nameZh.trim(),
        email: email.trim(),
        role,
        branch_ids: selectedBranches,
        temp_password: tempPassword,
        is_shared_device: isShared,
      });
      setCreatedPassword(tempPassword);
      toast.success(t("settings.staff.inviteSuccess"));
    } catch (e) {
      setErrMsg((e as Error).message);
    }
  };

  const copyPassword = async (pw: string) => {
    try {
      await navigator.clipboard.writeText(pw);
      toast.success(t("common.saved"));
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={createdPassword ? t("settings.staff.inviteSuccess") : t("settings.staff.inviteTitle")}
      size="md"
      footer={
        createdPassword ? (
          <Button variant="primary" onClick={onClose}>{t("actions.close") || "Close"}</Button>
        ) : (
          <>
            <Button variant="soft" onClick={onClose} disabled={inviteMut.isPending}>{t("actions.cancel")}</Button>
            <Button variant="primary" onClick={onSubmit} loading={inviteMut.isPending} disabled={!canSubmit}>
              {t("settings.staff.inviteButton")}
            </Button>
          </>
        )
      }
    >
      {createdPassword ? (
        <Stack gap={3}>
          <Alert severity="warning" description={t("settings.staff.invitePasswordWarning")} />
          <FormField label={t("settings.staff.tempPassword")}>
            <Inline gap={2} className="w-full">
              <div className="flex-1">
                <TextField value={createdPassword} readOnly />
              </div>
              <Button variant="soft" leadingIcon={<Copy size={14} />} onClick={() => copyPassword(createdPassword)}>
                {t("actions.copy") || "Copy"}
              </Button>
            </Inline>
          </FormField>
        </Stack>
      ) : (
        <Stack gap={3}>
          {errMsg && <Alert severity="error" description={errMsg} onDismiss={() => setErrMsg(null)} />}
          <Inline gap={3} className="w-full">
            <div className="flex-1">
              <FormField label={t("staff.fields.nameZh")} required>
                <TextField value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label={t("staff.fields.name")} required>
                <TextField value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
            </div>
          </Inline>
          <FormField label={t("staff.fields.email")} required>
            <TextField type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label={t("staff.fields.role")} required>
            <Select
              value={role}
              disabled={isShared}
              onChange={(e) => setRole((e.target as HTMLSelectElement).value as StaffRoleEnum)}
              options={availableRoles.map((r) => ({ value: r, label: roleLabel(t, r) }))}
            />
          </FormField>
          <FormField label={t("settings.staff.sharedDevice")} helper={t("settings.staff.sharedDeviceHint")}>
            <Switch checked={isShared} onChange={setIsShared} />
          </FormField>
          <FormField label={t("common.branches") || t("staff.fields.branches")} required>
            <Stack gap={2}>
              {visibleBranches.length === 0 && (
                <span className="type-body-sm" style={{ color: "var(--text-tertiary)" }}>—</span>
              )}
              {visibleBranches.map((b) => {
                const checked = selectedBranches.includes(b.id);
                const disabled = branchAdminLocked || (isShared && !checked && selectedBranches.length >= 1);
                return (
                  <Checkbox
                    key={b.id}
                    label={b.name_zh}
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => toggleBranch(b.id, (e.target as HTMLInputElement).checked)}
                  />
                );
              })}
            </Stack>
          </FormField>
          <FormField label={t("settings.staff.tempPassword")} required helper={t("settings.staff.invitePasswordWarning")}>
            <Inline gap={2} className="w-full">
              <div className="flex-1">
                <PasswordField value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
              </div>
              <Button variant="soft" onClick={() => setTempPassword(genTempPassword())}>
                {t("actions.regenerate") || "↻"}
              </Button>
              <Button variant="soft" leadingIcon={<Copy size={14} />} onClick={() => copyPassword(tempPassword)}>
                {t("actions.copy") || "Copy"}
              </Button>
            </Inline>
          </FormField>
        </Stack>
      )}
    </Modal>
  );
}

/* ─────────────────── Staff Detail Drawer ─────────────────── */

interface StaffDetailDrawerProps {
  staff: StaffRow | null;
  onClose: () => void;
  callerRole: StaffRoleEnum | undefined;
  callerBranchIds: string[];
  branches: Branch[];
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function StaffDetailDrawer({ staff, onClose, callerRole, callerBranchIds, branches }: StaffDetailDrawerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateMut = useUpdateStaff();
  const deactivateMut = useDeactivateStaff();
  const pinMut = useAdminPinAction();

  const open = !!staff;
  const canManage = callerRole === "SYSTEM_ADMIN" || callerRole === "BRANCH_ADMIN";
  const availableRoles = rolesAvailableTo(callerRole);
  const visibleBranches = useMemo(() => {
    if (callerRole === "SYSTEM_ADMIN") return branches;
    const set = new Set(callerBranchIds);
    return branches.filter((b) => set.has(b.id));
  }, [branches, callerRole, callerBranchIds]);

  const [form, setForm] = useState<StaffRow | null>(staff);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  useEffect(() => {
    setForm(staff);
    setErrMsg(null);
  }, [staff]);

  // Audit trail query
  const auditQuery = useQuery({
    queryKey: ["audit_logs", "staff", staff?.id ?? null],
    enabled: !!staff,
    queryFn: async () => {
      if (!staff) return [];
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, created_at, actor_id, actor_role")
        .or(`entity_id.eq.${staff.id},actor_id.eq.${staff.id}`)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Open items query (for deactivation)
  const openItemsQuery = useQuery({
    queryKey: ["staff_open_items", staff?.id ?? null],
    enabled: !!staff,
    queryFn: async () => {
      if (!staff) return { tasks: [], alerts: [] };
      const [tasks, alerts] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, due_at, resident_id, branch_id")
          .eq("assigned_to", staff.id)
          .in("status", ["PENDING", "IN_PROGRESS", "OVERDUE"]),
        supabase
          .from("alerts")
          .select("id, type, triggered_at, resident_id, branch_id")
          .eq("assigned_to", staff.id)
          .in("status", ["OPEN", "ACKNOWLEDGED"]),
      ]);
      return { tasks: tasks.data ?? [], alerts: alerts.data ?? [] };
    },
  });

  if (!staff || !form) {
    return <Drawer open={open} onClose={onClose} width={620} title="" children={null} />;
  }

  const dirty =
    form.name !== staff.name ||
    form.name_zh !== staff.name_zh ||
    form.phone !== staff.phone ||
    form.role !== staff.role ||
    form.is_shared_device !== staff.is_shared_device ||
    JSON.stringify([...(form.branch_ids ?? [])].sort()) !==
      JSON.stringify([...(staff.branch_ids ?? [])].sort());

  const branchAdminLocked = callerRole === "BRANCH_ADMIN";

  const toggleBranch = (id: string, checked: boolean) => {
    if (branchAdminLocked) return;
    setForm((s) => {
      if (!s) return s;
      const cur = s.branch_ids ?? [];
      const next = checked ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id);
      return { ...s, branch_ids: s.is_shared_device ? next.slice(0, 1) : next };
    });
  };

  const onSave = async () => {
    setErrMsg(null);
    try {
      await updateMut.mutateAsync({
        staffId: staff.id,
        before: staff,
        patch: {
          name: form.name,
          name_zh: form.name_zh,
          phone: form.phone,
          role: form.role,
          branch_ids: form.branch_ids,
          is_shared_device: form.is_shared_device,
        },
      });
      toast.success(t("common.saved"));
    } catch (e) {
      setErrMsg((e as Error).message);
    }
  };

  const initials = (form.name_zh || form.name || "?").slice(0, 2);
  const openTaskCount = openItemsQuery.data?.tasks.length ?? 0;
  const openAlertCount = openItemsQuery.data?.alerts.length ?? 0;
  const hasOpenItems = openTaskCount + openAlertCount > 0;

  const handleDeactivateClick = () => {
    if (hasOpenItems) setReassignOpen(true);
    else setConfirmDeactivate(true);
  };

  const doDeactivate = async (metadata?: Record<string, unknown>) => {
    try {
      await deactivateMut.mutateAsync({ staffId: staff.id, metadata });
      toast.success(t("common.saved"));
      onClose();
    } catch (e) {
      setErrMsg((e as Error).message);
    }
  };

  const doPinAction = async (action: "unlock" | "reset") => {
    try {
      await pinMut.mutateAsync({ staff_id: staff.id, action });
    } catch (e) {
      setErrMsg((e as Error).message);
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width={620}
        title={form.name_zh ?? form.name}
        footer={
          canManage && dirty ? (
            <Inline gap={2} justify="end">
              <Button variant="soft" onClick={() => setForm(staff)} disabled={updateMut.isPending}>
                {t("actions.cancel")}
              </Button>
              <Button variant="primary" onClick={onSave} loading={updateMut.isPending}>
                {t("actions.save")}
              </Button>
            </Inline>
          ) : null
        }
      >
        <Stack gap={4}>
          {errMsg && <Alert severity="error" description={errMsg} onDismiss={() => setErrMsg(null)} />}

          {/* Identity header */}
          <Inline gap={3} align="center">
            <Avatar name={initials} size="lg" />
            <Stack gap={1}>
              <span className="type-h3" style={{ color: "var(--text-primary)" }}>
                {form.name_zh ?? form.name}
              </span>
              <span className="type-body-sm" style={{ color: "var(--text-tertiary)" }}>
                {form.name} · {form.email}
              </span>
              <Inline gap={2}>
                <Badge tone={ROLE_TONE[form.role]}>{roleLabel(t, form.role)}</Badge>
                <Badge tone={STATUS_TONE[form.status]}>{t(`staff.status.${form.status}`)}</Badge>
                {form.is_shared_device && <Badge tone="warning">{t("settings.staff.sharedDevice")}</Badge>}
              </Inline>
            </Stack>
          </Inline>

          {/* Editable details */}
          <Surface padding="md">
            <Stack gap={3}>
              <Inline gap={3} className="w-full">
                <div className="flex-1">
                  <FormField label={t("staff.fields.nameZh")}>
                    <TextField
                      value={form.name_zh ?? ""}
                      onChange={(e) => setForm((s) => s ? { ...s, name_zh: e.target.value } : s)}
                      disabled={!canManage}
                    />
                  </FormField>
                </div>
                <div className="flex-1">
                  <FormField label={t("staff.fields.name")}>
                    <TextField
                      value={form.name}
                      onChange={(e) => setForm((s) => s ? { ...s, name: e.target.value } : s)}
                      disabled={!canManage}
                    />
                  </FormField>
                </div>
              </Inline>
              <FormField label={t("staff.fields.phone")}>
                <TextField
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((s) => s ? { ...s, phone: e.target.value } : s)}
                  disabled={!canManage}
                />
              </FormField>
              <FormField label={t("staff.fields.role")}>
                <Select
                  value={form.role}
                  disabled={!canManage || form.is_shared_device}
                  onChange={(e) => setForm((s) => s ? { ...s, role: (e.target as HTMLSelectElement).value as StaffRoleEnum } : s)}
                  options={availableRoles.map((r) => ({ value: r, label: roleLabel(t, r) }))}
                />
              </FormField>
              <FormField label={t("settings.staff.sharedDevice")} helper={t("settings.staff.sharedDeviceHint")}>
                <Switch
                  checked={form.is_shared_device}
                  onChange={(v) => setForm((s) => s ? { ...s, is_shared_device: v, role: v ? "NURSE" : s.role, branch_ids: v ? (s.branch_ids ?? []).slice(0, 1) : s.branch_ids } : s)}
                  disabled={!canManage}
                />
              </FormField>
              <FormField label={t("common.branches") || t("staff.fields.branches")}>
                <Stack gap={2}>
                  {visibleBranches.map((b) => {
                    const checked = (form.branch_ids ?? []).includes(b.id);
                    const disabled = !canManage || branchAdminLocked || (form.is_shared_device && !checked && (form.branch_ids ?? []).length >= 1);
                    return (
                      <Checkbox
                        key={b.id}
                        label={b.name_zh}
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => toggleBranch(b.id, (e.target as HTMLInputElement).checked)}
                      />
                    );
                  })}
                </Stack>
              </FormField>
            </Stack>
          </Surface>

          {/* PIN management */}
          {!form.is_shared_device && (
            <Surface padding="md">
              <Stack gap={3}>
                <Label>{t("settings.staff.pinStatus")}</Label>
                <Inline gap={2} align="center">
                  {form.pin_locked_at ? (
                    <>
                      <StatusDot tone="error" />
                      <span className="type-body-md" style={{ color: "var(--text-primary)" }}>
                        {t("settings.staff.pinLocked")} ({t("settings.staff.pinLockedSince")}: {fmtDateTime(form.pin_locked_at)})
                      </span>
                    </>
                  ) : form.pin_hash ? (
                    <>
                      <StatusDot tone="success" />
                      <span className="type-body-md" style={{ color: "var(--text-primary)" }}>{t("settings.staff.pinSet")}</span>
                    </>
                  ) : (
                    <>
                      <StatusDot tone="warning" />
                      <span className="type-body-md" style={{ color: "var(--text-primary)" }}>{t("settings.staff.pinNotSet")}</span>
                    </>
                  )}
                </Inline>
                {canManage && (
                  <Inline gap={2}>
                    {form.pin_locked_at && (
                      <Button variant="primary" onClick={() => setConfirmUnlock(true)} loading={pinMut.isPending}>
                        {t("settings.staff.unlockPin")}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setConfirmReset(true)} loading={pinMut.isPending}>
                      {t("settings.staff.resetPin")}
                    </Button>
                  </Inline>
                )}
              </Stack>
            </Surface>
          )}

          {/* Deactivation */}
          {canManage && form.status === "ACTIVE" && (
            <Surface padding="md">
              <Stack gap={2}>
                <Button variant="ghost" onClick={handleDeactivateClick}>
                  <span style={{ color: "var(--text-destructive)" }}>{t("settings.staff.deactivate")}</span>
                </Button>
                {hasOpenItems && (
                  <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>
                    {openTaskCount + openAlertCount} {t("settings.staff.reassignHint")}
                  </span>
                )}
              </Stack>
            </Surface>
          )}

          {/* Audit trail */}
          <Surface padding="md">
            <Stack gap={2}>
              <Inline justify="between" align="center">
                <Label>{t("settings.staff.auditTrail")}</Label>
                <button
                  type="button"
                  className="type-body-sm"
                  style={{ color: "var(--text-link)" }}
                  onClick={() => navigate({ to: "/audit" })}
                >
                  {t("settings.staff.viewFullAudit")}
                </button>
              </Inline>
              {auditQuery.isLoading ? (
                <Skeleton variant="row" height={40} />
              ) : (auditQuery.data ?? []).length === 0 ? (
                <span className="type-body-sm" style={{ color: "var(--text-tertiary)" }}>—</span>
              ) : (
                <Stack gap={1}>
                  {(auditQuery.data ?? []).map((a) => (
                    <Inline key={a.id} gap={2} className="w-full" justify="between">
                      <span className="type-body-sm" style={{ color: "var(--text-primary)" }}>{a.action}</span>
                      <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>{fmtDateTime(a.created_at)}</span>
                    </Inline>
                  ))}
                </Stack>
              )}
            </Stack>
          </Surface>
        </Stack>
      </Drawer>

      <ConfirmDialog
        open={confirmUnlock}
        onClose={() => setConfirmUnlock(false)}
        onConfirm={async () => { setConfirmUnlock(false); await doPinAction("unlock"); }}
        title={t("settings.staff.unlockPin")}
        summary={t("settings.staff.unlockConfirm")}
        confirmLabel={t("settings.staff.unlockPin")}
        cancelLabel={t("actions.cancel")}
        tone="approval"
      />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => { setConfirmReset(false); await doPinAction("reset"); }}
        title={t("settings.staff.resetPin")}
        summary={t("settings.staff.resetConfirm")}
        confirmLabel={t("settings.staff.resetPin")}
        cancelLabel={t("actions.cancel")}
      />
      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={async () => { setConfirmDeactivate(false); await doDeactivate(); }}
        title={t("settings.staff.deactivate")}
        summary={t("settings.staff.deactivateConfirm")}
        confirmLabel={t("settings.staff.deactivate")}
        cancelLabel={t("actions.cancel")}
      />

      <ReassignBeforeDeactivateModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        staff={staff}
        tasks={openItemsQuery.data?.tasks ?? []}
        alerts={openItemsQuery.data?.alerts ?? []}
        candidates={[]}
        onConfirm={async (assignments, reason) => {
          setReassignOpen(false);
          // Update tasks
          for (const a of assignments.tasks) {
            await supabase.from("tasks").update({ assigned_to: a.toStaffId }).eq("id", a.itemId);
          }
          for (const a of assignments.alerts) {
            await supabase.from("alerts").update({ assigned_to: a.toStaffId }).eq("id", a.itemId);
          }
          await doDeactivate({ reassignment_reason: reason, reassigned_tasks: assignments.tasks.length, reassigned_alerts: assignments.alerts.length });
        }}
      />
    </>
  );
}

/* ─────────────────── Reassign Before Deactivate Modal ─────────────────── */

interface OpenTask { id: string; title: string; due_at: string; resident_id: string; branch_id: string }
interface OpenAlert { id: string; type: string; triggered_at: string; resident_id: string; branch_id: string }
interface ReassignAssignment { itemId: string; toStaffId: string }
interface ReassignAssignments { tasks: ReassignAssignment[]; alerts: ReassignAssignment[] }

interface ReassignBeforeDeactivateModalProps {
  open: boolean;
  onClose: () => void;
  staff: StaffRow;
  tasks: OpenTask[];
  alerts: OpenAlert[];
  candidates: StaffRow[];
  onConfirm: (assignments: ReassignAssignments, reason: string) => void | Promise<void>;
}

function ReassignBeforeDeactivateModal({ open, onClose, staff, tasks, alerts, onConfirm }: ReassignBeforeDeactivateModalProps) {
  const { t } = useTranslation();
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string>>({});
  const [alertAssignments, setAlertAssignments] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch candidate staff (active, same branches as outgoing staff)
  const candQuery = useQuery({
    queryKey: ["reassign_candidates", staff.id],
    enabled: open,
    queryFn: async (): Promise<StaffRow[]> => {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("status", "ACTIVE")
        .is("deleted_at", null)
        .neq("id", staff.id)
        .overlaps("branch_ids", staff.branch_ids ?? []);
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });

  useEffect(() => {
    if (open) {
      setTaskAssignments({});
      setAlertAssignments({});
      setReason("");
    }
  }, [open]);

  const candidates = candQuery.data ?? [];
  const candidateOptions = [
    { value: "", label: "—" },
    ...candidates.map((c) => ({ value: c.id, label: c.name_zh ?? c.name })),
  ];

  const allAssigned =
    tasks.every((tk) => taskAssignments[tk.id]) &&
    alerts.every((al) => alertAssignments[al.id]);
  const canConfirm = allAssigned && reason.trim().length > 0 && !loading;

  const submit = async () => {
    setLoading(true);
    try {
      await onConfirm(
        {
          tasks: Object.entries(taskAssignments).map(([itemId, toStaffId]) => ({ itemId, toStaffId })),
          alerts: Object.entries(alertAssignments).map(([itemId, toStaffId]) => ({ itemId, toStaffId })),
        },
        reason.trim(),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("settings.staff.reassignTitle")}
      size="lg"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={loading}>{t("actions.cancel")}</Button>
          <Button variant="destructive" onClick={submit} loading={loading} disabled={!canConfirm}>
            {t("settings.staff.confirmReassignDeactivate")}
          </Button>
        </>
      }
    >
      <Stack gap={3}>
        <Alert severity="warning" description={t("settings.staff.reassignHint")} />
        {tasks.length > 0 && (
          <Card padding="md">
            <Stack gap={2}>
              <Label>{t("nav.tasks")}</Label>
              {tasks.map((tk) => (
                <Inline key={tk.id} gap={2} className="w-full" align="center">
                  <span className="type-body-sm flex-1" style={{ color: "var(--text-primary)" }}>
                    {tk.title} · {fmtDateTime(tk.due_at)}
                  </span>
                  <div style={{ width: 200 }}>
                    <Select
                      value={taskAssignments[tk.id] ?? ""}
                      onChange={(e) => setTaskAssignments((s) => ({ ...s, [tk.id]: (e.target as HTMLSelectElement).value }))}
                      options={candidateOptions}
                    />
                  </div>
                </Inline>
              ))}
            </Stack>
          </Card>
        )}
        {alerts.length > 0 && (
          <Card padding="md">
            <Stack gap={2}>
              <Label>{t("nav.alerts")}</Label>
              {alerts.map((al) => (
                <Inline key={al.id} gap={2} className="w-full" align="center">
                  <span className="type-body-sm flex-1" style={{ color: "var(--text-primary)" }}>
                    {al.type} · {fmtDateTime(al.triggered_at)}
                  </span>
                  <div style={{ width: 200 }}>
                    <Select
                      value={alertAssignments[al.id] ?? ""}
                      onChange={(e) => setAlertAssignments((s) => ({ ...s, [al.id]: (e.target as HTMLSelectElement).value }))}
                      options={candidateOptions}
                    />
                  </div>
                </Inline>
              ))}
            </Stack>
          </Card>
        )}
        <FormField label={t("settings.staff.reassignReason")} required>
          <TextField value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </Stack>
    </Modal>
  );
}
