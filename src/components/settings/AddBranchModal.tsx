import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, FormField, TextField, Select, Stack, Inline, Alert } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { TablesInsert, Enums } from "@/integrations/supabase/types";

type BranchType = Enums<"branch_type">;

interface AddBranchModalProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY = {
  name_zh: "",
  name: "",
  type: "CARE_HOME" as BranchType,
  address: "",
  swd_code: "",
  phone: "",
  email: "",
};

export function AddBranchModal({ open, onClose }: AddBranchModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const [form, setForm] = useState(EMPTY);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrMsg(null);
    }
  }, [open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: TablesInsert<"branches"> = {
        name_zh: form.name_zh.trim(),
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim(),
        swd_code: form.swd_code.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      };
      const { data, error } = await supabase
        .from("branches")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (newBranch) => {
      await logAction({
        action: "BRANCH_CREATED",
        entity_type: "branches",
        entity_id: newBranch.id,
        branch_id: newBranch.id,
        after_state: newBranch as unknown as Record<string, unknown>,
      });
      await qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success(t("branches.toastCreated"));
      onClose();
    },
    onError: (err: Error) => setErrMsg(err.message),
  });

  const canSubmit =
    form.name_zh.trim() &&
    form.name.trim() &&
    form.address.trim() &&
    form.swd_code.trim() &&
    !mutation.isPending;

  const typeOptions: { value: BranchType; label: string }[] = [
    { value: "CARE_HOME", label: t("branches.branchType.CARE_HOME") },
    { value: "DCU", label: t("branches.branchType.DCU") },
    { value: "HOUSING", label: t("branches.branchType.HOUSING") },
    { value: "REHABILITATION", label: t("branches.branchType.REHABILITATION") },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("branches.addBranch")}
      size="md"
      footer={
        <Inline gap={2} justify="end">
          <Button variant="soft" onClick={onClose} disabled={mutation.isPending}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
          >
            {t("actions.save")}
          </Button>
        </Inline>
      }
    >
      <Stack gap={3}>
        {errMsg && <Alert severity="error" description={errMsg} onDismiss={() => setErrMsg(null)} />}
        <FormField label={t("branches.fields.nameZh")} required>
          <TextField value={form.name_zh} onChange={(e) => set("name_zh", e.target.value)} />
        </FormField>
        <FormField label={t("branches.fields.name")} required>
          <TextField value={form.name} onChange={(e) => set("name", e.target.value)} />
        </FormField>
        <FormField label={t("branches.fields.type")} required>
          <Select
            value={form.type}
            onChange={(e) => set("type", (e.target as HTMLSelectElement).value as BranchType)}
            options={typeOptions}
          />
        </FormField>
        <FormField label={t("branches.fields.address")} required>
          <TextField value={form.address} onChange={(e) => set("address", e.target.value)} />
        </FormField>
        <FormField label={t("branches.fields.swdCode")} required>
          <TextField value={form.swd_code} onChange={(e) => set("swd_code", e.target.value)} />
        </FormField>
        <Inline gap={3} className="w-full">
          <div className="flex-1">
            <FormField label={t("branches.fields.phone")}>
              <TextField value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </FormField>
          </div>
          <div className="flex-1">
            <FormField label={t("branches.fields.email")}>
              <TextField type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </FormField>
          </div>
        </Inline>
      </Stack>
    </Modal>
  );
}
