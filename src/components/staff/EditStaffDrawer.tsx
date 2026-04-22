import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Drawer, Button, FormField, TextField, Select, Stack, Inline, Alert, Checkbox, Tabs,
  ConfirmDialog, Text,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import type { StaffRow } from "@/hooks/useStaff";
import type { Enums, TablesUpdate } from "@/integrations/supabase/types";

type StaffRole = Enums<"staff_role">;
type StaffStatus = Enums<"staff_status">;

interface EditStaffDrawerProps {
  open: boolean;
  onClose: () => void;
  staffMember: StaffRow | null;
  onOpenSetPIN?: (s: StaffRow) => void;
  onOpenUnlockPIN?: (s: StaffRow) => void;
}

const ROLES: StaffRole[] = [
  "SYSTEM_ADMIN", "BRANCH_ADMIN", "SENIOR_NURSE", "NURSE",
  "CAREGIVER", "DCU_WORKER", "FINANCE", "FAMILY",
];
const STATUSES: StaffStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

export function EditStaffDrawer({
  open, onClose, staffMember, onOpenSetPIN, onOpenUnlockPIN,
}: EditStaffDrawerProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { logAction } = useAuditLog();
  const { branches } = useBranches();
  const { staff: currentStaff } = useCurrentStaff();

  const canManage = currentStaff?.role === "SYSTEM_ADMIN" || currentStaff?.role === "BRANCH_ADMIN";

  const [tab, setTab] = useState<"basic" | "branches" | "pin" | "workload">("basic");
  const [nameZh, setNameZh] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("NURSE");
  const [status, setStatus] = useState<StaffStatus>("ACTIVE");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmDeact, setConfirmDeact] = useState(false);

  const original = useMemo(() => staffMember, [staffMember]);

  useEffect(() => {
    if (open && staffMember) {
      setNameZh(staffMember.name_zh ?? "");
      setName(staffMember.name);
      setPhone(staffMember.phone ?? "");
      setRole(staffMember.role);
      setStatus(staffMember.status);
      setBranchIds(staffMember.branch_ids ?? []);
      setTab("basic");
      setErrMsg(null);
    }
  }, [open, staffMember]);

  const toggleBranch = (id: string) => {
    setBranchIds((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
  };

  const saveBasic = useMutation({
    mutationFn: async () => {
      if (!staffMember) throw new Error("No staff");
      const payload: TablesUpdate<"staff"> = {
        name_zh: nameZh.trim(),
        name: name.trim(),
        phone: phone.trim() || null,
        role,
        status,
      };
      const { data, error } = await supabase
        .from("staff").update(payload).eq("id", staffMember.id).select("*").single();
      if (error) throw error;
      await logAction({
        action: "STAFF_UPDATED",
        entity_type: "staff",
        entity_id: staffMember.id,
        branch_id: staffMember.branch_ids?.[0] ?? null,
        before_state: { name_zh: original?.name_zh, name: original?.name, phone: original?.phone, role: original?.role, status: original?.status } as Record<string, unknown>,
        after_state: { name_zh: payload.name_zh, name: payload.name, phone: payload.phone, role: payload.role, status: payload.status } as Record<string, unknown>,
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t("staff.updateSuccess"));
      onClose();
    },
    onError: (err) => setErrMsg((err as Error).message),
  });

  const saveBranches = useMutation({
    mutationFn: async () => {
      if (!staffMember) throw new Error("No staff");
      const finalBranchIds = role === "SYSTEM_ADMIN" ? [] : branchIds;
      const { data, error } = await supabase
        .from("staff").update({ branch_ids: finalBranchIds })
        .eq("id", staffMember.id).select("*").single();
      if (error) throw error;
      await logAction({
        action: "STAFF_BRANCH_UPDATED",
        entity_type: "staff",
        entity_id: staffMember.id,
        before_state: { branch_ids: original?.branch_ids } as Record<string, unknown>,
        after_state: { branch_ids: finalBranchIds } as Record<string, unknown>,
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t("staff.updateSuccess"));
    },
    onError: (err) => setErrMsg((err as Error).message),
  });

  const setActivation = useMutation({
    mutationFn: async (next: StaffStatus) => {
      if (!staffMember) throw new Error("No staff");
      const { data, error } = await supabase
        .from("staff").update({ status: next })
        .eq("id", staffMember.id).select("*").single();
      if (error) throw error;
      await logAction({
        action: next === "ACTIVE" ? "STAFF_REACTIVATED" : "STAFF_DEACTIVATED",
        entity_type: "staff",
        entity_id: staffMember.id,
        before_state: { status: staffMember.status } as Record<string, unknown>,
        after_state: { status: next } as Record<string, unknown>,
      });
      return data;
    },
    onSuccess: (_d, next) => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t(next === "ACTIVE" ? "staff.reactivateSuccess" : "staff.deactivateSuccess"));
      setConfirmDeact(false);
      onClose();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (!staffMember) return null;

  const roleOptions = ROLES.map((r) => ({ value: r, label: t(`staff.roles.${r}`) }));
  const statusOptions = STATUSES.map((s) => ({ value: s, label: t(`staff.status.${s}`) }));
  const isActive = staffMember.status === "ACTIVE";

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width={520}
        title={staffMember.name_zh || staffMember.name}
        footer={
          <Inline gap={2} justify="between" className="w-full">
            <div>
              {canManage && (
                isActive ? (
                  <Button variant="ghost" onClick={() => setConfirmDeact(true)}>
                    {t("staff.deactivate")}
                  </Button>
                ) : (
                  <Button variant="soft" onClick={() => setActivation.mutate("ACTIVE")} loading={setActivation.isPending}>
                    {t("staff.reactivate")}
                  </Button>
                )
              )}
            </div>
            <Inline gap={2}>
              <Button variant="soft" onClick={onClose}>{t("actions.cancel")}</Button>
              {tab === "basic" && (
                <Button variant="primary" onClick={() => saveBasic.mutate()} loading={saveBasic.isPending}>
                  {t("actions.save")}
                </Button>
              )}
              {tab === "branches" && (
                <Button variant="primary" onClick={() => saveBranches.mutate()} loading={saveBranches.isPending}>
                  {t("actions.save")}
                </Button>
              )}
            </Inline>
          </Inline>
        }
      >
        <Stack gap={4}>
          <Tabs
            style="line"
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            items={[
              { value: "basic", label: t("staff.tabs.basic") },
              { value: "branches", label: t("staff.tabs.branches") },
              { value: "pin", label: t("staff.tabs.pin") },
              { value: "workload", label: t("staff.tabs.workload") },
            ]}
          />

          {errMsg && <Alert severity="error" description={errMsg} onDismiss={() => setErrMsg(null)} />}

          {tab === "basic" && (
            <Stack gap={3}>
              <FormField label={t("staff.email")}>
                <TextField value={staffMember.email} disabled />
              </FormField>
              <Inline gap={3} className="w-full" align="start">
                <div className="flex-1">
                  <FormField label={t("staff.nameZh")} required>
                    <TextField value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
                  </FormField>
                </div>
                <div className="flex-1">
                  <FormField label={t("staff.nameEn")} required>
                    <TextField value={name} onChange={(e) => setName(e.target.value)} />
                  </FormField>
                </div>
              </Inline>
              <FormField label={t("staff.phone")}>
                <TextField value={phone} onChange={(e) => setPhone(e.target.value)} />
              </FormField>
              <FormField label={t("staff.role")} required>
                <Select
                  value={role}
                  onChange={(e) => setRole((e.target as HTMLSelectElement).value as StaffRole)}
                  options={roleOptions}
                />
              </FormField>
              <FormField label={t("status", { defaultValue: "Status" })}>
                <Select
                  value={status}
                  onChange={(e) => setStatus((e.target as HTMLSelectElement).value as StaffStatus)}
                  options={statusOptions}
                />
              </FormField>
            </Stack>
          )}

          {tab === "branches" && (
            <Stack gap={3}>
              {role === "SYSTEM_ADMIN" ? (
                <Alert severity="info" description={t("staff.systemAdminAllBranches")} />
              ) : branches.length === 0 ? (
                <Text size="sm" color="tertiary">{t("branches.emptyTitle")}</Text>
              ) : (
                <Stack gap={2}>
                  {branches.map((b) => (
                    <Checkbox
                      key={b.id}
                      label={`${b.name_zh} · ${b.name}`}
                      checked={branchIds.includes(b.id)}
                      onChange={() => toggleBranch(b.id)}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          )}

          {tab === "pin" && (
            <Stack gap={3}>
              <Alert severity="info" description={t("staff.setPinHint")} />
              <Inline gap={2}>
                <Button variant="primary" onClick={() => onOpenSetPIN?.(staffMember)}>
                  {staffMember.pin_hash ? t("staff.resetPin") : t("staff.setPin")}
                </Button>
                {staffMember.pin_locked_at && (
                  <Button variant="soft" onClick={() => onOpenUnlockPIN?.(staffMember)}>
                    {t("staff.unlockPin")}
                  </Button>
                )}
              </Inline>
            </Stack>
          )}

          {tab === "workload" && (
            <Stack gap={3}>
              <Alert severity="info" description={t("staff.workloadDrawerHint")} />
              <div>
                <Button
                  variant="primary"
                  onClick={() => {
                    onClose();
                    navigate({ to: "/staff/$id", params: { id: staffMember.id } });
                  }}
                >
                  {t("staff.viewDetail")}
                </Button>
              </div>
            </Stack>
          )}
        </Stack>
      </Drawer>

      <ConfirmDialog
        open={confirmDeact}
        onClose={() => setConfirmDeact(false)}
        onConfirm={() => setActivation.mutate("INACTIVE")}
        title={t("staff.deactivate")}
        summary={t("staff.deactivateConfirm")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
      />
    </>
  );
}
