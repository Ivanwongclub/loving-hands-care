import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, Select, Stack, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, Enums } from "@/integrations/supabase/types";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface NewWoundModalProps {
  open: boolean;
  onClose: () => void;
  residentId: string;
  branchId: string;
  staffId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

const WOUND_TYPES = ["PRESSURE_INJURY", "SURGICAL", "TRAUMATIC", "OTHER"] as const;
const STAGES = ["STAGE_1", "STAGE_2", "STAGE_3", "STAGE_4", "UNSTAGEABLE", "DEEP_TISSUE"] as const;
const NEW_STATUSES = ["OPEN", "HEALING", "DETERIORATING"] as const;

type WoundType = (typeof WOUND_TYPES)[number];
type WoundStatus = Enums<"wound_status">;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewWoundModal({ open, onClose, residentId, branchId, staffId, logAction }: NewWoundModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [location, setLocation] = useState("");
  const [woundType, setWoundType] = useState<WoundType>("PRESSURE_INJURY");
  const [stage, setStage] = useState<string>("STAGE_1");
  const [firstNoted, setFirstNoted] = useState(todayISO());
  const [status, setStatus] = useState<WoundStatus>("OPEN");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocation("");
      setWoundType("PRESSURE_INJURY");
      setStage("STAGE_1");
      setFirstNoted(todayISO());
      setStatus("OPEN");
      setErr(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!location.trim()) {
      setErr(t("wounds.location"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const insertRow: TablesInsert<"wounds"> = {
        resident_id: residentId,
        branch_id: branchId,
        location_desc: location.trim(),
        wound_type: woundType,
        stage: woundType === "PRESSURE_INJURY" ? stage : null,
        first_noted_at: firstNoted,
        status,
        created_by: staffId,
      };
      const { data, error } = await supabase.from("wounds").insert(insertRow).select().single();
      if (error) throw error;
      await logAction({
        action: "WOUND_CREATED",
        entity_type: "wounds",
        entity_id: data.id,
        branch_id: branchId,
        after_state: data as unknown as Record<string, unknown>,
      });
      void qc.invalidateQueries({ queryKey: ["wounds", residentId] });
      toast.success(t("wounds.createSuccess"));
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
      title={t("wounds.new")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>{t("actions.save")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        {err && <Alert severity="error" description={err} />}
        <FormField label={t("wounds.location")} required>
          <TextField
            placeholder={t("wounds.locationPlaceholder")}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </FormField>
        <FormField label={t("wounds.woundType")} required>
          <Select
            value={woundType}
            onChange={(e) => setWoundType((e.target as HTMLSelectElement).value as WoundType)}
            options={WOUND_TYPES.map((w) => ({ value: w, label: t(`wounds.type.${w}`) }))}
          />
        </FormField>
        {woundType === "PRESSURE_INJURY" && (
          <FormField label={t("wounds.stage")}>
            <Select
              value={stage}
              onChange={(e) => setStage((e.target as HTMLSelectElement).value)}
              options={STAGES.map((s) => ({ value: s, label: t(`wounds.stages.${s}`) }))}
            />
          </FormField>
        )}
        <FormField label={t("wounds.firstNoted")} required>
          <TextField type="date" value={firstNoted} onChange={(e) => setFirstNoted(e.target.value)} />
        </FormField>
        <FormField label={t("residents.columns.status")} required>
          <Select
            value={status}
            onChange={(e) => setStatus((e.target as HTMLSelectElement).value as WoundStatus)}
            options={NEW_STATUSES.map((s) => ({ value: s, label: t(`wounds.status.${s}`) }))}
          />
        </FormField>
      </Stack>
    </Modal>
  );
}
