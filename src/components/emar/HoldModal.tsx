import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal, Button, FormField, TextArea, Stack, Alert } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface HoldModalProps {
  open: boolean;
  onClose: () => void;
  recordId: string | null;
  residentId: string;
  branchId: string;
  date: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

export function HoldModal({
  open, onClose, recordId, residentId, branchId, date, logAction,
}: HoldModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setErr(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!recordId) return;
    if (!reason.trim()) {
      setErr(t("emar.holdReason"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const after = {
        status: "HELD" as const,
        hold_reason: reason.trim(),
      };
      const { error } = await supabase
        .from("emar_records")
        .update(after)
        .eq("id", recordId);
      if (error) throw error;
      await logAction({
        action: "EMAR_HELD",
        entity_type: "emar_records",
        entity_id: recordId,
        branch_id: branchId,
        before_state: { status: "DUE" },
        after_state: after as unknown as Record<string, unknown>,
      });
      void qc.invalidateQueries({ queryKey: ["emarRecords", residentId, date] });
      toast.success(t("emar.markHeld"));
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("emar.markHeld")}
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="primary" loading={saving} onClick={handleConfirm}>{t("actions.confirm")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        {err && <Alert severity="error" description={err} />}
        <FormField label={t("emar.holdReason")} required>
          <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </Stack>
    </Modal>
  );
}
