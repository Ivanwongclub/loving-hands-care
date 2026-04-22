import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, Select, Stack, Inline, Alert, Checkbox, Text,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useBranches } from "@/hooks/useBranches";
import type { Enums, TablesInsert } from "@/integrations/supabase/types";

type StaffRole = Enums<"staff_role">;
type StaffStatus = Enums<"staff_status">;

interface NewStaffModalProps {
  open: boolean;
  onClose: () => void;
}

const ROLES: StaffRole[] = [
  "SYSTEM_ADMIN", "BRANCH_ADMIN", "SENIOR_NURSE", "NURSE",
  "CAREGIVER", "DCU_WORKER", "FINANCE", "FAMILY",
];
const STATUSES: StaffStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"];

export function NewStaffModal({ open, onClose }: NewStaffModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { branches } = useBranches();

  const [nameZh, setNameZh] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("NURSE");
  const [status, setStatus] = useState<StaffStatus>("ACTIVE");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNameZh(""); setName(""); setEmail(""); setPhone("");
      setRole("NURSE"); setStatus("ACTIVE"); setBranchIds([]); setErrMsg(null);
    }
  }, [open]);

  const toggleBranch = (id: string) => {
    setBranchIds((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!nameZh.trim() || !name.trim() || !email.trim()) throw new Error("Required fields missing");
      const finalBranchIds = role === "SYSTEM_ADMIN" ? [] : branchIds;
      const payload: TablesInsert<"staff"> = {
        name_zh: nameZh.trim(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        role,
        status,
        branch_ids: finalBranchIds,
      };
      const { data, error } = await supabase
        .from("staff").insert(payload).select("*").single();
      if (error) throw error;

      const { pin_hash: _ph, ...safeAfter } = data;
      await logAction({
        action: "STAFF_CREATED",
        entity_type: "staff",
        entity_id: data.id,
        branch_id: finalBranchIds[0] ?? null,
        after_state: safeAfter as unknown as Record<string, unknown>,
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t("staff.createSuccess"));
      onClose();
    },
    onError: (err) => setErrMsg((err as Error).message),
  });

  const sendInvite = () => {
    toast.info(t("staff.inviteManual"));
  };

  const roleOptions = ROLES.map((r) => ({ value: r, label: t(`staff.roles.${r}`) }));
  const statusOptions = STATUSES.map((s) => ({ value: s, label: t(`staff.status.${s}`) }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("staff.new")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={sendInvite} disabled={mutation.isPending}>
            {t("staff.inviteStaff")}
          </Button>
          <Button variant="soft" onClick={onClose} disabled={mutation.isPending}>
            {t("actions.cancel")}
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("actions.save")}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        {errMsg && <Alert severity="error" description={errMsg} onDismiss={() => setErrMsg(null)} />}

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

        <FormField label={t("staff.authEmail")} required helper={t("staff.authHint")}>
          <TextField type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>

        <Inline gap={3} className="w-full" align="start">
          <div className="flex-1">
            <FormField label={t("staff.phone")}>
              <TextField value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label={t("staff.role")} required>
              <Select
                value={role}
                onChange={(e) => setRole((e.target as HTMLSelectElement).value as StaffRole)}
                options={roleOptions}
              />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label={t("status", { defaultValue: "Status" })}>
              <Select
                value={status}
                onChange={(e) => setStatus((e.target as HTMLSelectElement).value as StaffStatus)}
                options={statusOptions}
              />
            </FormField>
          </div>
        </Inline>

        <FormField label={t("staff.branchAccess")} helper={t("staff.branchAccessHint")}>
          {role === "SYSTEM_ADMIN" ? (
            <Alert severity="info" description={t("staff.systemAdminAllBranches")} />
          ) : (
            <Stack gap={2}>
              {branches.length === 0 ? (
                <Text size="sm" color="tertiary">{t("branches.emptyTitle")}</Text>
              ) : (
                branches.map((b) => (
                  <Checkbox
                    key={b.id}
                    label={`${b.name_zh} · ${b.name}`}
                    checked={branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                  />
                ))
              )}
            </Stack>
          )}
        </FormField>

        <Alert severity="info" description={t("staff.inviteHint")} />
      </Stack>
    </Modal>
  );
}
