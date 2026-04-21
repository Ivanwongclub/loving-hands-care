import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, TextArea, Select, Stack, Inline, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, Enums } from "@/integrations/supabase/types";
import type { useAuditLog } from "@/hooks/useAuditLog";
import type { WoundRow } from "@/hooks/useWounds";

interface AddWoundEntryModalProps {
  open: boolean;
  onClose: () => void;
  wound: WoundRow | null;
  residentId: string;
  branchId: string;
  staffId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

type WoundStatus = Enums<"wound_status">;
const STATUSES: WoundStatus[] = ["OPEN", "HEALING", "HEALED", "DETERIORATING"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddWoundEntryModal({
  open, onClose, wound, residentId, branchId, staffId, logAction,
}: AddWoundEntryModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [assessedAt, setAssessedAt] = useState(todayISO());
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [appearance, setAppearance] = useState("");
  const [exudate, setExudate] = useState("");
  const [treatment, setTreatment] = useState("");
  const [status, setStatus] = useState<WoundStatus>("OPEN");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && wound) {
      setAssessedAt(todayISO());
      setLength("");
      setWidth("");
      setDepth("");
      setAppearance("");
      setExudate("");
      setTreatment("");
      setStatus(wound.status);
      setPhoto(null);
      setErr(null);
    }
  }, [open, wound]);

  if (!wound) return null;

  const handleSave = async () => {
    if (!treatment.trim()) {
      setErr(t("wounds.treatment"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      let photoPath: string | null = null;
      if (photo) {
        const cleanName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `residents/${residentId}/wounds/${wound.id}/${Date.now()}_${cleanName}`;
        const { error: upErr } = await supabase.storage
          .from("resident-documents")
          .upload(path, photo, { upsert: false });
        if (upErr) throw upErr;
        photoPath = path;
      }

      const sizeCm =
        length || width || depth
          ? {
              length: length ? Number(length) : null,
              width: width ? Number(width) : null,
              depth: depth ? Number(depth) : null,
            }
          : null;

      const entryRow: TablesInsert<"wound_entries"> = {
        wound_id: wound.id,
        branch_id: branchId,
        assessed_at: new Date(`${assessedAt}T12:00:00`).toISOString(),
        assessed_by: staffId,
        size_cm: sizeCm as unknown as TablesInsert<"wound_entries">["size_cm"],
        appearance: appearance.trim() || null,
        exudate: exudate.trim() || null,
        treatment: treatment.trim(),
        photo_path: photoPath,
        status,
      };
      const { data: entryData, error: entryErr } = await supabase
        .from("wound_entries")
        .insert(entryRow)
        .select()
        .single();
      if (entryErr) throw entryErr;

      // Sync wound status from latest entry
      const woundUpdate: { status: WoundStatus; healed_at?: string } = { status };
      if (status === "HEALED") woundUpdate.healed_at = assessedAt;
      const { error: woundErr } = await supabase.from("wounds").update(woundUpdate).eq("id", wound.id);
      if (woundErr) throw woundErr;

      await logAction({
        action: "WOUND_ENTRY_ADDED",
        entity_type: "wound_entries",
        entity_id: entryData.id,
        branch_id: branchId,
        after_state: entryData as unknown as Record<string, unknown>,
        metadata: { wound_id: wound.id, new_wound_status: status },
      });
      void qc.invalidateQueries({ queryKey: ["wounds", residentId] });
      toast.success(t("wounds.entrySuccess"));
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
      title={t("wounds.addEntry")}
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
        <FormField label={t("wounds.assessedAt")} required>
          <TextField type="date" value={assessedAt} onChange={(e) => setAssessedAt(e.target.value)} />
        </FormField>
        <FormField label={t("wounds.size")}>
          <Inline gap={2} className="w-full">
            <TextField type="number" step={0.1} placeholder={t("wounds.length")} value={length} onChange={(e) => setLength(e.target.value)} />
            <TextField type="number" step={0.1} placeholder={t("wounds.width")} value={width} onChange={(e) => setWidth(e.target.value)} />
            <TextField type="number" step={0.1} placeholder={t("wounds.depth")} value={depth} onChange={(e) => setDepth(e.target.value)} />
          </Inline>
        </FormField>
        <FormField label={t("wounds.appearance")}>
          <TextField value={appearance} onChange={(e) => setAppearance(e.target.value)} />
        </FormField>
        <FormField label={t("wounds.exudate")}>
          <TextField value={exudate} onChange={(e) => setExudate(e.target.value)} />
        </FormField>
        <FormField label={t("wounds.treatment")} required>
          <TextArea rows={3} value={treatment} onChange={(e) => setTreatment(e.target.value)} />
        </FormField>
        <FormField label={t("residents.columns.status")} required>
          <Select
            value={status}
            onChange={(e) => setStatus((e.target as HTMLSelectElement).value as WoundStatus)}
            options={STATUSES.map((s) => ({ value: s, label: t(`wounds.status.${s}`) }))}
          />
        </FormField>
        <FormField label={t("wounds.photoOptional")}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="type-body-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </FormField>
      </Stack>
    </Modal>
  );
}
