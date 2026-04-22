import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal, Button, FormField, TextArea, Stack } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { AlertRow } from "@/hooks/useAlerts";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface ResolveModalProps {
  open: boolean;
  onClose: () => void;
  alert: AlertRow | null;
  branchId: string;
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

export function ResolveModal({ open, onClose, alert, branchId, staffId, logAction }: ResolveModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!alert) return null;

  const handleConfirm = async () => {
    if (!staffId || !notes.trim()) return;
    setBusy(true);
    try {
      const before = { status: alert.status, resolved_by: alert.resolved_by, resolved_at: alert.resolved_at, resolution_notes: alert.resolution_notes };
      const after = {
        status: "RESOLVED" as const,
        resolved_by: staffId,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes.trim(),
      };
      const { error } = await supabase.from("alerts").update(after).eq("id", alert.id);
      if (error) throw error;

      await logAction({
        action: "ALERT_RESOLVED",
        entity_type: "alerts",
        entity_id: alert.id,
        branch_id: branchId,
        before_state: before,
        after_state: after,
      });

      toast.success(t("alerts.resolveSuccess"));
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
      title={t("alerts.resolve")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("actions.cancel")}</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={busy || !notes.trim()}>{t("actions.confirm")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        <FormField label={t("alerts.resolutionNotes")} required>
          <TextArea
            rows={3}
            value={notes}
            onChange={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
            placeholder={t("alerts.resolutionNotesPlaceholder")}
          />
        </FormField>
      </Stack>
    </Modal>
  );
}
