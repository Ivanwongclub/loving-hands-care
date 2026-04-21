import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Drawer, Button, FormField, TextField, TextArea, NumberField, Select, Stack, Inline,
  Alert, Avatar, Text,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { DCUEnrollment, DCUEnrollmentStatus } from "@/hooks/useDCUEnrollments";

interface EnrollmentEditDrawerProps {
  open: boolean;
  onClose: () => void;
  enrollment: DCUEnrollment | null;
  branchId: string | null;
}

export function EnrollmentEditDrawer({
  open,
  onClose,
  enrollment,
  branchId,
}: EnrollmentEditDrawerProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState<number | undefined>(undefined);
  const [transportNotes, setTransportNotes] = useState("");
  const [status, setStatus] = useState<DCUEnrollmentStatus>("ACTIVE");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open && enrollment) {
      setStartDate(enrollment.start_date);
      setEndDate(enrollment.end_date ?? "");
      setDaysPerWeek(enrollment.days_per_week ?? undefined);
      setTransportNotes(enrollment.transport_notes ?? "");
      setStatus(enrollment.status);
      setErrMsg(null);
    }
  }, [open, enrollment]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!enrollment) throw new Error("No enrollment");
      const before = { ...enrollment };
      const updates = {
        start_date: startDate,
        end_date: endDate || null,
        days_per_week: typeof daysPerWeek === "number" && daysPerWeek > 0 ? daysPerWeek : null,
        transport_notes: transportNotes.trim() || null,
        status,
      };
      const { data, error } = await supabase
        .from("dcu_enrollments")
        .update(updates)
        .eq("id", enrollment.id)
        .select("*")
        .single();
      if (error) throw error;

      await logAction({
        action: "DCU_ENROLLMENT_UPDATED",
        entity_type: "dcu_enrollments",
        entity_id: enrollment.id,
        branch_id: enrollment.branch_id,
        before_state: before as unknown as Record<string, unknown>,
        after_state: data as unknown as Record<string, unknown>,
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcuEnrollments", branchId] });
      toast.success(t("branches.toastSaved"));
      onClose();
    },
    onError: (err) => setErrMsg((err as Error).message),
  });

  const statusOptions: { value: DCUEnrollmentStatus; label: string }[] = [
    { value: "ACTIVE", label: t("dcu.status.ACTIVE") },
    { value: "SUSPENDED", label: t("dcu.status.SUSPENDED") },
    { value: "DISCHARGED", label: t("dcu.status.DISCHARGED") },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("dcu.enrollmentDetail")}
      width={480}
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={mutation.isPending}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!enrollment || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("actions.save")}
          </Button>
        </>
      }
    >
      {!enrollment ? null : (
        <Stack gap={4}>
          {errMsg && <Alert severity="error" title={errMsg} />}

          <Inline gap={2}>
            <Avatar name={enrollment.residents?.name_zh ?? enrollment.residents?.name ?? "?"} size="md" />
            <Stack gap={1}>
              <Text size="md" className="font-semibold">
                {enrollment.residents?.name_zh ?? "—"}
              </Text>
              <Text size="sm" color="secondary">
                {enrollment.residents?.name ?? ""}
              </Text>
            </Stack>
          </Inline>

          <FormField label={t("dcu.status.ACTIVE").toString().replace(/.*/, "Status")}>
            <Select
              value={status}
              onChange={(e) => setStatus((e.target as HTMLSelectElement).value as DCUEnrollmentStatus)}
              options={statusOptions}
            />
          </FormField>

          <Inline gap={3} className="w-full" align="start">
            <div className="flex-1">
              <FormField label={t("dcu.startDate")} required>
                <TextField type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label={t("dcu.endDate")}>
                <TextField type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </FormField>
            </div>
          </Inline>

          <FormField label={t("dcu.daysPerWeek")}>
            <NumberField
              numericValue={daysPerWeek}
              onValueChange={(v) => setDaysPerWeek(Math.max(0, Math.min(7, Math.round(v))))}
              step={1}
              min={1}
              max={7}
            />
          </FormField>

          <FormField label={t("dcu.transportNotes")}>
            <TextArea
              value={transportNotes}
              onChange={(e) => setTransportNotes(e.target.value)}
              rows={3}
            />
          </FormField>
        </Stack>
      )}
    </Drawer>
  );
}
