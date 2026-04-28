import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Modal, Button, Stack, Inline, Text, FormField, Select, TextArea, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { useAuditLog } from "@/hooks/useAuditLog";

export type WanderingLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";

interface WanderingAssessmentModalProps {
  open: boolean;
  onClose: () => void;
  resident: {
    id: string;
    branch_id: string;
    wandering_risk_level: string | null;
    wandering_risk_notes: string | null;
    medical_history: unknown;
  };
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
  onSaved: () => void | Promise<void>;
}

const DEMENTIA_KEYWORDS = ["認知障礙", "失智", "癡呆", "dementia", "alzheimer"];

function hasDementia(medical: unknown): boolean {
  if (!medical || typeof medical !== "object") return false;
  const obj = medical as Record<string, unknown>;
  const dx = typeof obj.diagnoses === "string" ? obj.diagnoses : "";
  if (!dx) return false;
  const lower = dx.toLowerCase();
  return DEMENTIA_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

const LEVELS: WanderingLevel[] = ["NONE", "LOW", "MEDIUM", "HIGH"];

export function WanderingAssessmentModal({
  open, onClose, resident, staffId, logAction, onSaved,
}: WanderingAssessmentModalProps) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<WanderingLevel>(
    (resident.wandering_risk_level as WanderingLevel | null) ?? "NONE",
  );
  const [notes, setNotes] = useState(resident.wandering_risk_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLevel((resident.wandering_risk_level as WanderingLevel | null) ?? "NONE");
      setNotes(resident.wandering_risk_notes ?? "");
      setError(null);
    }
  }, [open, resident]);

  const dementiaSuggested = useMemo(() => hasDementia(resident.medical_history), [resident.medical_history]);
  const showDementiaHint = dementiaSuggested && (level === "NONE" || level === "LOW");

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const before = {
        wandering_risk_level: resident.wandering_risk_level,
        wandering_risk_notes: resident.wandering_risk_notes,
      };
      const after = {
        wandering_risk_level: level,
        wandering_risk_notes: notes.trim() || null,
        wandering_risk_assessed_by: staffId,
        wandering_risk_assessed_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from("residents")
        .update(after)
        .eq("id", resident.id);
      if (upErr) throw upErr;
      await logAction({
        action: "WANDERING_RISK_ASSESSED",
        entity_type: "residents",
        entity_id: resident.id,
        branch_id: resident.branch_id,
        before_state: before,
        after_state: after,
      });
      toast.success(t("common.saved"));
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("wandering.modalTitle")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>{t("wandering.saveAssessment")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        {error && <Alert severity="error" description={error} />}
        {showDementiaHint && (
          <Alert severity="info" description={t("wandering.dementiaSuggestion")} />
        )}
        <FormField label={t("wandering.label")} required>
          <Select
            value={level}
            onChange={(e) => setLevel((e.target as HTMLSelectElement).value as WanderingLevel)}
            options={LEVELS.map((l) => ({ value: l, label: t(`wandering.${l}`) }))}
          />
        </FormField>
        <Text size="sm" color="secondary">
          {t(`wandering.${level === "NONE" ? "noneHelper" : level === "LOW" ? "lowHelper" : level === "MEDIUM" ? "mediumHelper" : "highHelper"}`)}
        </Text>
        <FormField label={t("wandering.notes")}>
          <TextArea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("wandering.notesPlaceholder")}
          />
        </FormField>
        <Inline gap={2} align="center">
          <Text size="caption" color="tertiary">
            {t("wandering.lastAssessment")}: {(resident as unknown as { wandering_risk_assessed_at?: string | null }).wandering_risk_assessed_at
              ? new Date((resident as unknown as { wandering_risk_assessed_at: string }).wandering_risk_assessed_at).toISOString().slice(0, 10)
              : t("wandering.neverAssessed")}
          </Text>
        </Inline>
      </Stack>
    </Modal>
  );
}
