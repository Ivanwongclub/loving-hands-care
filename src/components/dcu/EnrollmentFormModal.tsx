import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, TextArea, NumberField, Stack, Inline,
  SearchField, Avatar, Alert, Spinner, Text,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useResidents } from "@/hooks/useResidents";
import type { TablesInsert } from "@/integrations/supabase/types";

interface EnrollmentFormModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string | null;
}

const today = (): string => new Date().toISOString().slice(0, 10);

export function EnrollmentFormModal({ open, onClose, branchId }: EnrollmentFormModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();

  const [residentSearch, setResidentSearch] = useState("");
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState<number | undefined>(undefined);
  const [transportNotes, setTransportNotes] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const { residents, isLoading: residentsLoading } = useResidents({
    branchId,
    search: residentSearch,
    status: "ADMITTED",
    page: 1,
    pageSize: 50,
  });

  useEffect(() => {
    if (open) {
      setResidentSearch("");
      setSelectedResidentId(null);
      setStartDate(today());
      setEndDate("");
      setDaysPerWeek(undefined);
      setTransportNotes("");
      setErrMsg(null);
    }
  }, [open]);

  const selectedResident = useMemo(
    () => residents.find((r) => r.id === selectedResidentId) ?? null,
    [residents, selectedResidentId],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("No branch context");
      if (!selectedResidentId) throw new Error("Select a resident");
      if (!startDate) throw new Error("Start date is required");

      const payload: TablesInsert<"dcu_enrollments"> = {
        branch_id: branchId,
        resident_id: selectedResidentId,
        start_date: startDate,
        end_date: endDate || null,
        days_per_week: typeof daysPerWeek === "number" && daysPerWeek > 0 ? daysPerWeek : null,
        transport_notes: transportNotes.trim() || null,
        status: "ACTIVE",
      };

      const { data, error } = await supabase
        .from("dcu_enrollments")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;

      await logAction({
        action: "DCU_ENROLLMENT_CREATED",
        entity_type: "dcu_enrollments",
        entity_id: data.id,
        branch_id: branchId,
        after_state: data as unknown as Record<string, unknown>,
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcuEnrollments", branchId] });
      toast.success(t("dcu.enrollSuccess"));
      onClose();
    },
    onError: (err) => setErrMsg((err as Error).message),
  });

  const canSubmit = !!selectedResidentId && !!startDate && !mutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dcu.newEnrollment")}
      size="md"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={mutation.isPending}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("actions.save")}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        {errMsg && <Alert severity="error" title={errMsg} />}

        <FormField label={t("dcu.selectResident")} required>
          <SearchField
            placeholder={t("residents.searchPlaceholder")}
            value={residentSearch}
            onChange={(e) => setResidentSearch(e.target.value)}
            onClear={() => setResidentSearch("")}
          />
          <div
            style={{
              marginTop: 8,
              maxHeight: 200,
              overflowY: "auto",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            {residentsLoading ? (
              <div style={{ padding: 16, display: "grid", placeItems: "center" }}>
                <Spinner size="sm" />
              </div>
            ) : residents.length === 0 ? (
              <div style={{ padding: 12 }}>
                <Text size="sm" color="tertiary">
                  {t("dcu.noResidents")}
                </Text>
              </div>
            ) : (
              residents.map((r) => {
                const active = r.id === selectedResidentId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedResidentId(r.id)}
                    className="w-full text-left transition-colors"
                    style={{
                      padding: "8px 12px",
                      backgroundColor: active ? "var(--bg-selected)" : "transparent",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <Inline gap={2}>
                      <Avatar name={r.name_zh || r.name} size="sm" />
                      <Stack gap={1}>
                        <span className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>
                          {r.name_zh}
                        </span>
                        <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>
                          {r.name}
                        </span>
                      </Stack>
                    </Inline>
                  </button>
                );
              })
            )}
          </div>
          {selectedResident && (
            <div style={{ marginTop: 6 }}>
              <Text size="sm" color="secondary">
                {t("dcu.selectedResident", { defaultValue: "Selected" })}: {selectedResident.name_zh}
              </Text>
            </div>
          )}
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
    </Modal>
  );
}
