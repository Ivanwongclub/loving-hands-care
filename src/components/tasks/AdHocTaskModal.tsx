import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, TextArea, Select, Stack, Inline, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import type { useAuditLog } from "@/hooks/useAuditLog";
import type { TaskType } from "@/hooks/useTasks";

interface AdHocTaskModalProps {
  open: boolean;
  onClose: () => void;
  residentId: string;
  branchId: string;
  staffId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

const TASK_TYPES: TaskType[] = ["ADL", "VITALS", "MEDICATION_PREP", "WOUND_CARE", "REPOSITIONING", "ASSESSMENT", "FOLLOW_UP", "OTHER"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdHocTaskModal({ open, onClose, residentId, branchId, staffId, logAction }: AdHocTaskModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { staff } = useCurrentStaff();

  const [type, setType] = useState<TaskType>("ADL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [dueHour, setDueHour] = useState("09");
  const [assignedTo, setAssignedTo] = useState<string>(staffId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType("ADL");
      setTitle("");
      setDescription("");
      setDueDate(todayISO());
      setDueHour("09");
      setAssignedTo(staffId);
      setErr(null);
    }
  }, [open, staffId]);

  const handleSave = async () => {
    if (!title.trim()) {
      setErr(t("tasks.title2"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const dueAt = new Date(`${dueDate}T${dueHour}:00:00`).toISOString();
      const insertRow: TablesInsert<"tasks"> = {
        branch_id: branchId,
        resident_id: residentId,
        icp_id: null,
        type,
        title: title.trim(),
        description: description.trim() || null,
        due_at: dueAt,
        assigned_to: assignedTo || null,
        status: "PENDING",
      };
      const { data, error } = await supabase.from("tasks").insert(insertRow).select().single();
      if (error) throw error;
      await logAction({
        action: "TASK_CREATED",
        entity_type: "tasks",
        entity_id: data.id,
        branch_id: branchId,
        after_state: data as unknown as Record<string, unknown>,
        metadata: { ad_hoc: true },
      });
      void qc.invalidateQueries({ queryKey: ["tasks", residentId] });
      toast.success(t("tasks.createSuccess"));
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
      title={t("tasks.addAdHoc")}
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
        <FormField label={t("icp.taskRuleType")} required>
          <Select
            value={type}
            onChange={(e) => setType((e.target as HTMLSelectElement).value as TaskType)}
            options={TASK_TYPES.map((tt) => ({ value: tt, label: t(`tasks.type.${tt}`) }))}
          />
        </FormField>
        <FormField label={t("tasks.title2")} required>
          <TextField value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label={t("tasks.description")}>
          <TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <Inline gap={2} className="w-full" align="start">
          <div className="flex-1">
            <FormField label={t("tasks.dueDate")} required>
              <TextField type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
          </div>
          <div style={{ width: 140 }}>
            <FormField label={t("tasks.dueTime")} required>
              <Select
                value={dueHour}
                onChange={(e) => setDueHour((e.target as HTMLSelectElement).value)}
                options={Array.from({ length: 24 }).map((_, h) => ({
                  value: String(h).padStart(2, "0"),
                  label: `${String(h).padStart(2, "0")}:00`,
                }))}
              />
            </FormField>
          </div>
        </Inline>
        <FormField label={t("tasks.assignedTo")}>
          <Select
            value={assignedTo}
            onChange={(e) => setAssignedTo((e.target as HTMLSelectElement).value)}
            options={[
              { value: staffId, label: `${t("tasks.myself")}${staff?.name_zh ? ` (${staff.name_zh})` : ""}` },
            ]}
          />
        </FormField>
      </Stack>
    </Modal>
  );
}
