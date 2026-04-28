import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, TextArea, NumberField, Switch, Radio,
  Stack, Inline, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface ObservationModalProps {
  open: boolean;
  onClose: () => void;
  restraintRecordId: string | null;
  residentId: string;
  branchId: string;
  staffId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

const SKIN_OPTIONS = ["NORMAL", "REDNESS", "BREAKDOWN", "BRUISING"] as const;

function nowLocalISO(): string {
  // datetime-local format: YYYY-MM-DDTHH:mm
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ObservationModal({
  open, onClose, restraintRecordId, residentId, branchId, staffId, logAction,
}: ObservationModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [observedAt, setObservedAt] = useState(nowLocalISO());
  const [inUse, setInUse] = useState(true);
  const [skinCondition, setSkinCondition] = useState<string>("NORMAL");
  const [circulationNormal, setCirculationNormal] = useState(true);
  const [residentResponse, setResidentResponse] = useState("");
  const [releasedForMinutes, setReleasedForMinutes] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setObservedAt(nowLocalISO());
      setInUse(true);
      setSkinCondition("NORMAL");
      setCirculationNormal(true);
      setResidentResponse("");
      setReleasedForMinutes("");
      setNotes("");
      setSaving(false);
      setErr(null);
    }
  }, [open]);

  const abnormal = skinCondition !== "NORMAL" || !circulationNormal;

  const handleSubmit = async () => {
    if (!restraintRecordId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("restraint_observations")
        .insert({
          restraint_record_id: restraintRecordId,
          observed_at: new Date(observedAt).toISOString(),
          observed_by_staff_id: staffId,
          in_use: inUse,
          skin_condition: skinCondition,
          circulation_normal: circulationNormal,
          resident_response: residentResponse || null,
          released_for_minutes: releasedForMinutes ? Number(releasedForMinutes) : null,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await logAction({
        action: "RESTRAINT_OBSERVATION_RECORDED",
        entity_type: "restraint_observations",
        entity_id: data?.id as string,
        branch_id: branchId,
        before_state: null,
        after_state: { restraint_record_id: restraintRecordId, skin_condition: skinCondition, in_use: inUse },
      });
      await qc.invalidateQueries({ queryKey: ["restraintRecords", residentId] });
      await qc.invalidateQueries({ queryKey: ["restraintObservations", restraintRecordId] });
      toast.success(t("restraints.addObservation"));
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
      title={t("restraints.addObservation")}
      size="md"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("actions.saving") || "Saving…" : t("actions.save")}
          </Button>
        </>
      }
    >
      <Stack gap={3}>
        {err && <Alert severity="error" title={err} />}
        <FormField label={t("restraints.lastObservation")}>
          <TextField type="datetime-local" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} />
        </FormField>
        <Switch checked={inUse} onChange={setInUse} label={t("restraints.obsInUse")} />
        <FormField label={t("restraints.skinCondition.label")} required>
          <Inline gap={3} wrap>
            {SKIN_OPTIONS.map((s) => (
              <Radio
                key={s}
                name="skin_condition"
                value={s}
                checked={skinCondition === s}
                onChange={() => setSkinCondition(s)}
                label={t(`restraints.skinCondition.${s}`)}
              />
            ))}
          </Inline>
        </FormField>
        <Switch checked={circulationNormal} onChange={setCirculationNormal} label={t("restraints.obsCirculation")} />
        <FormField label={t("restraints.obsResidentResponse")}>
          <TextField
            placeholder={t("restraints.obsResponsePlaceholder")}
            value={residentResponse}
            onChange={(e) => setResidentResponse(e.target.value)}
          />
        </FormField>
        <FormField label={t("restraints.obsReleasedMinutes")} helper={t("restraints.obsReleasedHelper")}>
          <NumberField
            value={releasedForMinutes}
            onChange={(e) => setReleasedForMinutes(e.target.value)}
            min={0}
          />
        </FormField>
        <FormField label={t("residents.notes") || "Notes"}>
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        {abnormal && (
          <Alert severity="error" title={t("restraints.obsAbnormalBanner")} />
        )}
      </Stack>
    </Modal>
  );
}
