import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal, Button, FormField, TextField, Stack, Inline, Text, Badge } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { AlertRow } from "@/hooks/useAlerts";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface AssignModalProps {
  open: boolean;
  onClose: () => void;
  alert: AlertRow | null;
  branchId: string;
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

export function AssignModal({ open, onClose, alert, branchId, staffId, logAction }: AssignModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!alert) return null;

  const handleConfirm = async () => {
    if (!staffId) return;
    setBusy(true);
    try {
      const before = { status: alert.status, assigned_to: alert.assigned_to, assigned_at: alert.assigned_at };
      const after = {
        status: "ASSIGNED" as const,
        assigned_to: staffId,
        assigned_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("alerts").update(after).eq("id", alert.id);
      if (error) throw error;

      await logAction({
        action: "ALERT_ASSIGNED",
        entity_type: "alerts",
        entity_id: alert.id,
        branch_id: branchId,
        before_state: before,
        after_state: after,
        metadata: notes.trim() ? { notes: notes.trim() } : null,
      });

      toast.success(t("alerts.assignSuccess"));
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      setNotes("");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t("alerts.assign")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("actions.cancel")}</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={busy}>{t("actions.confirm")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        <Inline gap={2} align="center">
          <Text size="sm">{t("alerts.assignedTo")}:</Text>
          <Badge tone="info">{t("alerts.assignToSelf")}</Badge>
        </Inline>
        <FormField label={t("alerts.assignNotes")}>
          <TextField
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>
      </Stack>
    </Modal>
  );
}
