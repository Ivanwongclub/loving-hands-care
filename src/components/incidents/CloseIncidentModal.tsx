import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal, Button, FormField, TextField, TextArea, Stack, Alert } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface CloseIncidentModalProps {
  open: boolean;
  onClose: () => void;
  incidentId: string | null;
  branchId: string;
  staffId: string;
  currentStatus: string;
  onClosed?: () => void;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CloseIncidentModal({
  open, onClose, incidentId, branchId, staffId, currentStatus, onClosed, logAction,
}: CloseIncidentModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNotes("");
      setDate(todayISO());
      setErr(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!incidentId) return;
    if (!notes.trim()) {
      setErr(t("incidents.closureNotes"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const closedAt = new Date(`${date}T${new Date().toISOString().slice(11, 19)}`).toISOString();
      const after = {
        status: "CLOSED" as const,
        closed_at: closedAt,
        closed_by: staffId,
        closure_notes: notes.trim(),
      };
      const { error } = await supabase.from("incidents").update(after).eq("id", incidentId);
      if (error) throw error;
      await logAction({
        action: "INCIDENT_CLOSED",
        entity_type: "incidents",
        entity_id: incidentId,
        branch_id: branchId,
        before_state: { status: currentStatus },
        after_state: after,
      });
      void qc.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(t("incidents.closeSuccess"));
      onClosed?.();
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
      title={t("incidents.closeIncident")}
      size="md"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="destructive" loading={saving} onClick={handleConfirm}>{t("incidents.closeIncident")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        <Alert severity="warning" description={t("incidents.closeConfirm")} />
        {err && <Alert severity="error" description={err} />}
        <FormField label={t("incidents.closureNotes")} required>
          <TextArea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <FormField label={t("incidents.closedAt")} required>
          <TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      </Stack>
    </Modal>
  );
}
