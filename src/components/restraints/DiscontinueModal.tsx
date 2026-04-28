import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextArea, DateField, Stack, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface DiscontinueModalProps {
  open: boolean;
  onClose: () => void;
  recordId: string | null;
  residentId: string;
  branchId: string;
  staffId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function todayISO(): string { return new Date().toISOString().slice(0, 10); }

export function DiscontinueModal({
  open, onClose, recordId, residentId, branchId, staffId, logAction,
}: DiscontinueModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [discontinuedDate, setDiscontinuedDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDiscontinuedDate(todayISO());
      setReason("");
      setSaving(false);
      setErr(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!recordId) return;
    if (!reason.trim()) {
      setErr(t("restraints.discontinueReason"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("restraint_records")
        .update({
          status: "DISCONTINUED",
          discontinued_date: discontinuedDate,
          discontinued_reason: reason,
          discontinued_by_staff_id: staffId,
        })
        .eq("id", recordId);
      if (error) throw error;

      await logAction({
        action: "RESTRAINT_RECORD_DISCONTINUED",
        entity_type: "restraint_records",
        entity_id: recordId,
        branch_id: branchId,
        before_state: { status: "ACTIVE" },
        after_state: { status: "DISCONTINUED", reason },
      });
      await qc.invalidateQueries({ queryKey: ["restraintRecords", residentId] });
      toast.success(t("restraints.discontinueTitle"));
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("restraints.discontinueTitle")}
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={saving}>
            {saving ? t("actions.saving") || "Saving…" : t("restraints.discontinue")}
          </Button>
        </>
      }
    >
      <Stack gap={3}>
        <Alert severity="warning" title={t("restraints.discontinueConfirm")} />
        {err && <Alert severity="error" title={err} />}
        <FormField label={t("restraints.endDate")} required>
          <DateField value={discontinuedDate} onChange={(e) => setDiscontinuedDate(e.target.value)} />
        </FormField>
        <FormField label={t("restraints.discontinueReason")} required helper={t("restraints.discontinueReasonHelper")}>
          <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </Stack>
    </Modal>
  );
}
