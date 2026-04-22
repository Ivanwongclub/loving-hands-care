import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal, Button, FormField, TextArea, Stack, Text, Badge, Inline } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { AlertRow } from "@/hooks/useAlerts";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface EscalateModalProps {
  open: boolean;
  onClose: () => void;
  alert: AlertRow | null;
  branchId: string;
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

export function EscalateModal({ open, onClose, alert, branchId, staffId, logAction }: EscalateModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!alert) return null;
  const currentLevel = alert.escalation_level ?? 0;
  const newLevel = currentLevel + 1;

  const handleConfirm = async () => {
    if (!staffId || !reason.trim()) return;
    setBusy(true);
    try {
      const before = { status: alert.status, escalation_level: currentLevel, last_escalated_at: alert.last_escalated_at };
      const nowIso = new Date().toISOString();
      const after: {
        escalation_level: number;
        last_escalated_at: string;
        status?: AlertRow["status"];
      } = { escalation_level: newLevel, last_escalated_at: nowIso };
      if (alert.status === "OPEN") after.status = "ACKNOWLEDGED";

      const { error: upErr } = await supabase.from("alerts").update(after).eq("id", alert.id);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("alert_escalations").insert({
        alert_id: alert.id,
        from_level: currentLevel,
        to_level: newLevel,
        reason: reason.trim(),
        notified_staff: [staffId],
        channel: null,
        escalated_at: nowIso,
      });
      if (insErr) throw insErr;

      await logAction({
        action: "ALERT_ESCALATED",
        entity_type: "alerts",
        entity_id: alert.id,
        branch_id: branchId,
        before_state: before,
        after_state: { ...after, escalation_level: newLevel },
        metadata: { from_level: currentLevel, to_level: newLevel, reason: reason.trim() },
      });

      toast.success(t("alerts.escalateSuccess"));
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["alert_escalations", alert.id] });
      setReason("");
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
      size="md"
      title={t("alerts.escalate")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("actions.cancel")}</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={busy || !reason.trim()}>{t("actions.confirm")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        <Text size="sm" color="secondary">{t("alerts.escalateConfirm")}</Text>
        <Inline gap={2} align="center">
          <Text size="sm">{t("alerts.escalationLevel")}:</Text>
          <Badge tone="neutral">Lv.{currentLevel}</Badge>
          <Text size="sm" color="tertiary">→</Text>
          <Badge tone="error">Lv.{newLevel}</Badge>
        </Inline>
        <FormField label={t("alerts.escalationReason")} required>
          <TextArea
            rows={3}
            value={reason}
            onChange={(e) => setReason((e.target as HTMLTextAreaElement).value)}
            placeholder={t("alerts.escalationReasonPlaceholder")}
          />
        </FormField>
      </Stack>
    </Modal>
  );
}
