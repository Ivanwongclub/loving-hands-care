import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal, Button, FormField, TextArea, Stack, Alert } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface StopOrderModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  residentId: string;
  branchId: string;
  staffId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

export function StopOrderModal({
  open, onClose, orderId, residentId, branchId, staffId, logAction,
}: StopOrderModalProps) {
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
    if (!orderId) return;
    if (!reason.trim()) {
      setErr(t("emar.stopReason"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const after = {
        status: "STOPPED" as const,
        stopped_at: new Date().toISOString(),
        stopped_by: staffId,
        stop_reason: reason.trim(),
      };
      const { error } = await supabase
        .from("medication_orders")
        .update(after)
        .eq("id", orderId);
      if (error) throw error;
      await logAction({
        action: "MEDICATION_ORDER_STOPPED",
        entity_type: "medication_orders",
        entity_id: orderId,
        branch_id: branchId,
        before_state: { status: "ACTIVE" },
        after_state: after as unknown as Record<string, unknown>,
      });
      void qc.invalidateQueries({ queryKey: ["medicationOrders", residentId] });
      toast.success(t("emar.orderStopped"));
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
      title={t("emar.stopOrder")}
      size="md"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="destructive" loading={saving} onClick={handleConfirm}>{t("emar.stopOrder")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        <Alert severity="warning" description={t("emar.stopConfirm")} />
        {err && <Alert severity="error" description={err} />}
        <FormField label={t("emar.stopReason")} required>
          <TextArea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </Stack>
    </Modal>
  );
}
