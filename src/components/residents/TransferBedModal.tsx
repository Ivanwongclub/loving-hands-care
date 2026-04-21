import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Modal, Button, Stack, Inline, Alert, Badge, FormField, TextField, Text,
} from "@/components/hms";
import { FacilityTree } from "@/components/hms/FacilityTree";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useLocations } from "@/hooks/useLocations";

export interface TransferBedModalProps {
  open: boolean;
  onClose: () => void;
  resident: { id: string; branch_id: string; bed_id: string | null; name_zh: string };
  onTransferred: () => void;
}

export function TransferBedModal({ open, onClose, resident, onTransferred }: TransferBedModalProps) {
  const { t } = useTranslation();
  const { staff } = useCurrentStaff();
  const { logAction } = useAuditLog();
  const { flatList } = useLocations(resident.branch_id);

  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [selectedBedCode, setSelectedBedCode] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedBedId(null);
      setSelectedBedCode(null);
      setReason("");
      setError(null);
    }
  }, [open]);

  const currentBedCode = useMemo(() => {
    if (!resident.bed_id) return null;
    return flatList.find((n) => n.id === resident.bed_id)?.code ?? null;
  }, [resident.bed_id, flatList]);

  const canSubmit = !!selectedBedId && reason.trim().length > 0 && !saving;

  const handleConfirm = async () => {
    if (!canSubmit || !staff?.id || !selectedBedId) return;
    setSaving(true);
    setError(null);
    try {
      const oldBedId = resident.bed_id;

      // 1. Update resident bed
      const { error: rErr } = await supabase
        .from("residents")
        .update({ bed_id: selectedBedId })
        .eq("id", resident.id);
      if (rErr) throw rErr;

      // 2. Free old bed
      if (oldBedId) {
        const { error: oErr } = await supabase
          .from("locations")
          .update({ status: "AVAILABLE" })
          .eq("id", oldBedId);
        if (oErr) throw oErr;
      }

      // 3. Occupy new bed
      const { error: nErr } = await supabase
        .from("locations")
        .update({ status: "OCCUPIED" })
        .eq("id", selectedBedId);
      if (nErr) throw nErr;

      // 4. Vacate old bed_assignment
      if (oldBedId) {
        await supabase
          .from("bed_assignments")
          .update({ vacated_at: new Date().toISOString() })
          .eq("resident_id", resident.id)
          .eq("bed_id", oldBedId)
          .is("vacated_at", null);
      }

      // 5. Insert new bed_assignment
      const { error: bErr } = await supabase.from("bed_assignments").insert({
        resident_id: resident.id,
        bed_id: selectedBedId,
        branch_id: resident.branch_id,
        assigned_by: staff.id,
        reason,
      });
      if (bErr) throw bErr;

      // 6. Audit
      void logAction({
        action: "RESIDENT_TRANSFERRED",
        entity_type: "residents",
        entity_id: resident.id,
        branch_id: resident.branch_id,
        before_state: { bed_id: oldBedId },
        after_state: { bed_id: selectedBedId, reason },
      });

      toast.success(t("transfer.success"));
      onTransferred();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`${t("transfer.title")} — ${resident.name_zh}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="primary" loading={saving} disabled={!canSubmit} onClick={handleConfirm}>
            {t("actions.confirm")}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        {error && <Alert severity="error" description={error} />}

        {currentBedCode ? (
          <Text size="sm" color="secondary">
            {t("transfer.currentBed")}: <span style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>{currentBedCode}</span>
          </Text>
        ) : null}

        <Text size="sm" color="secondary">{t("transfer.selectBed")}</Text>

        <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
          <FacilityTree
            branchId={resident.branch_id}
            selectable
            showAvailableOnly
            selectedBedId={selectedBedId ?? undefined}
            onSelectBed={(id, code) => {
              setSelectedBedId(id);
              setSelectedBedCode(code);
            }}
          />
        </div>

        {selectedBedCode ? (
          <Inline gap={2}>
            <Badge tone="info">
              {t("admission.selectedBed")}: {selectedBedCode}
            </Badge>
          </Inline>
        ) : (
          <Text size="sm" color="tertiary">{t("admission.noBedSelected")}</Text>
        )}

        <FormField label={t("transfer.reasonLabel")} required>
          <TextField
            value={reason}
            placeholder={t("transfer.reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      </Stack>
    </Modal>
  );
}
