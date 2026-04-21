import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Drawer, Button, FormField, TextField, Select, Stack, Inline, Alert, Switch, Tabs, Spinner,
} from "@/components/hms";
import { FacilityTree } from "@/components/hms/FacilityTree";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { Tables, TablesUpdate, Enums } from "@/integrations/supabase/types";

type BranchType = Enums<"branch_type">;
export type Branch = Tables<"branches">;

interface BranchEditDrawerProps {
  open: boolean;
  onClose: () => void;
  branch: Branch | null;
}

export function BranchEditDrawer({ open, onClose, branch }: BranchEditDrawerProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const [tab, setTab] = useState<"basic" | "settings" | "locations">("basic");
  const [form, setForm] = useState<Branch | null>(branch);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(branch);
      setTab("basic");
      setErrMsg(null);
    }
  }, [open, branch]);

  const original = useMemo(() => branch, [branch]);

  const set = <K extends keyof Branch>(k: K, v: Branch[K]) =>
    setForm((s) => (s ? { ...s, [k]: v } : s));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form || !original) throw new Error("No branch loaded");
      const payload: TablesUpdate<"branches"> = {
        name_zh: form.name_zh.trim(),
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim(),
        swd_code: form.swd_code.trim(),
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        is_active: form.is_active,
      };
      const { data, error } = await supabase
        .from("branches")
        .update(payload)
        .eq("id", form.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (updated) => {
      await logAction({
        action: "BRANCH_UPDATED",
        entity_type: "branches",
        entity_id: updated.id,
        branch_id: updated.id,
        before_state: original as unknown as Record<string, unknown>,
        after_state: updated as unknown as Record<string, unknown>,
      });
      await qc.invalidateQueries({ queryKey: ["branches"] });
      await qc.invalidateQueries({ queryKey: ["locations", updated.id] });
      toast.success(t("branches.toastSaved"));
      onClose();
    },
    onError: (err: Error) => setErrMsg(err.message),
  });

  if (!form) {
    return (
      <Drawer open={open} onClose={onClose} width={560} title={t("branches.detail")}>
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      </Drawer>
    );
  }

  const typeOptions: { value: BranchType; label: string }[] = [
    { value: "CARE_HOME", label: t("branches.branchType.CARE_HOME") },
    { value: "DCU", label: t("branches.branchType.DCU") },
    { value: "HOUSING", label: t("branches.branchType.HOUSING") },
    { value: "REHABILITATION", label: t("branches.branchType.REHABILITATION") },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={form.name_zh || form.name}
      footer={
        tab === "basic" ? (
          <Inline gap={2} justify="end">
            <Button variant="soft" onClick={onClose} disabled={mutation.isPending}>
              {t("actions.cancel")}
            </Button>
            <Button variant="primary" onClick={() => mutation.mutate()} loading={mutation.isPending}>
              {t("actions.save")}
            </Button>
          </Inline>
        ) : null
      }
    >
      <Stack gap={4}>
        <Tabs
          style="line"
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          items={[
            { value: "basic", label: t("branches.tabs.basic") },
            { value: "settings", label: t("branches.tabs.settings") },
            { value: "locations", label: t("branches.tabs.locations") },
          ]}
        />

        {tab === "basic" && (
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
                  <TextField value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                </FormField>
              </div>
              <div className="flex-1">
                <FormField label={t("branches.fields.email")}>
                  <TextField type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                </FormField>
              </div>
            </Inline>
            <FormField label={t("branches.fields.isActive")}>
              <Switch checked={form.is_active} onChange={(v) => set("is_active", v)} />
            </FormField>
          </Stack>
        )}

        {tab === "settings" && (
          <Stack gap={3}>
            <div>
              <div className="type-label mb-2" style={{ color: "var(--text-tertiary)" }}>SLA Config</div>
              <pre
                className="font-mono text-xs whitespace-pre-wrap break-words"
                style={{
                  backgroundColor: "var(--bg-subtle)",
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                }}
              >
                {JSON.stringify(form.sla_config ?? {}, null, 2)}
              </pre>
            </div>
            <div>
              <div className="type-label mb-2" style={{ color: "var(--text-tertiary)" }}>Notification Config</div>
              <pre
                className="font-mono text-xs whitespace-pre-wrap break-words"
                style={{
                  backgroundColor: "var(--bg-subtle)",
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                }}
              >
                {JSON.stringify(form.notification_config ?? {}, null, 2)}
              </pre>
            </div>
          </Stack>
        )}

        {tab === "locations" && (
          <FacilityTree branchId={form.id} />
        )}
      </Stack>
    </Drawer>
  );
}
