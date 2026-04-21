import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Modal, Button, Stack, Alert, FormField, DateField, Select, TextArea, Checkbox,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";

export interface DischargeModalProps {
  open: boolean;
  onClose: () => void;
  resident: { id: string; branch_id: string; bed_id: string | null; name_zh: string };
  onDischarged: () => void;
}

const REASONS = ["RECOVERY", "TRANSFER", "FAMILY", "OTHER"] as const;

function todayISODate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DischargeModal({ open, onClose, resident, onDischarged }: DischargeModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logAction } = useAuditLog();

  const [step, setStep] = useState<1 | 2>(1);
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false, false, false]);
  const [dischargeDate, setDischargeDate] = useState<string>(todayISODate());
  const [reason, setReason] = useState<(typeof REASONS)[number]>("RECOVERY");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setChecks([false, false, false, false, false, false]);
      setDischargeDate(todayISODate());
      setReason("RECOVERY");
      setNotes("");
      setError(null);
    }
  }, [open]);

  const allChecked = checks.every(Boolean);

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const oldBedId = resident.bed_id;

      // 1. Update resident
      const { error: rErr } = await supabase
        .from("residents")
        .update({
          status: "DISCHARGED",
          discharge_date: dischargeDate,
          bed_id: null,
        })
        .eq("id", resident.id);
      if (rErr) throw rErr;

      // 2. Free bed
      if (oldBedId) {
        const { error: oErr } = await supabase
          .from("locations")
          .update({ status: "AVAILABLE" })
          .eq("id", oldBedId);
        if (oErr) throw oErr;

        await supabase
          .from("bed_assignments")
          .update({ vacated_at: new Date().toISOString() })
          .eq("resident_id", resident.id)
          .eq("bed_id", oldBedId)
          .is("vacated_at", null);
      }

      // 3. Audit
      void logAction({
        action: "RESIDENT_DISCHARGED",
        entity_type: "residents",
        entity_id: resident.id,
        branch_id: resident.branch_id,
        after_state: {
          status: "DISCHARGED",
          discharge_date: dischargeDate,
          reason,
          notes: notes || null,
          bed_id: null,
        },
      });

      toast.success(t("discharge.success"));
      onDischarged();
      onClose();
      navigate({ to: "/residents" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discharge failed");
    } finally {
      setSaving(false);
    }
  };

  const reasonOptions = REASONS.map((v) => ({ value: v, label: t(`discharge.reasons.${v}`) }));

  if (step === 1) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={`${t("discharge.title")} — ${resident.name_zh}`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>{t("actions.cancel")}</Button>
            <Button variant="primary" disabled={!allChecked} onClick={() => setStep(2)}>
              {t("actions.next")}
            </Button>
          </>
        }
      >
        <Stack gap={3}>
          <div className="type-h3" style={{ color: "var(--text-primary)" }}>{t("discharge.checklist")}</div>
          <div className="type-body-sm" style={{ color: "var(--text-secondary)" }}>{t("discharge.checklistHint")}</div>
          <Stack gap={2}>
            {[1, 2, 3, 4, 5, 6].map((n, i) => (
              <Checkbox
                key={n}
                checked={checks[i]}
                onChange={(e) => {
                  const next = [...checks];
                  next[i] = e.target.checked;
                  setChecks(next);
                }}
                label={t(`discharge.item${n}`)}
              />
            ))}
          </Stack>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`${t("discharge.confirmTitle")} — ${resident.name_zh}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="destructive" loading={saving} onClick={handleConfirm}>
            {t("discharge.confirm")}
          </Button>
        </>
      }
    >
      <Stack gap={3}>
        {error && <Alert severity="error" description={error} />}
        <FormField label={t("discharge.dateLabel")} required>
          <DateField value={dischargeDate} onChange={(e) => setDischargeDate(e.target.value)} />
        </FormField>
        <FormField label={t("discharge.reasonLabel")} required>
          <Select
            value={reason}
            onChange={(e) => setReason((e.target as HTMLSelectElement).value as (typeof REASONS)[number])}
            options={reasonOptions}
          />
        </FormField>
        <FormField label={t("discharge.notesLabel")}>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <Alert severity="warning" description={t("discharge.consequence")} />
      </Stack>
    </Modal>
  );
}
