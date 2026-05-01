import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, WifiOff } from "lucide-react";
import {
  Card, Stack, Inline, Text, Heading, Button, FormField, TextField, TextArea, Select,
  Surface, Alert, Spinner, EmptyState, Badge, Divider,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useVitals, type VitalsRow } from "@/hooks/useVitals";
import { useVitalsThresholds, type ThresholdMap, type ThresholdRange } from "@/hooks/useVitalsThresholds";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface VitalsTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

type VitalKey =
  | "bp_systolic"
  | "bp_diastolic"
  | "pulse"
  | "spo2"
  | "temp_c"
  | "weight_kg"
  | "glucose_mmol";

type VitalReadings = Partial<Record<VitalKey, number>>;

const VITAL_FIELDS: { key: VitalKey; unitKey: keyof typeof UNIT_KEYS; step: number; min: number; max: number; hasMax: boolean }[] = [
  { key: "bp_systolic", unitKey: "bp", step: 1, min: 40, max: 300, hasMax: true },
  { key: "bp_diastolic", unitKey: "bp", step: 1, min: 20, max: 200, hasMax: true },
  { key: "pulse", unitKey: "pulse", step: 1, min: 20, max: 300, hasMax: true },
  { key: "spo2", unitKey: "spo2", step: 1, min: 50, max: 100, hasMax: false },
  { key: "temp_c", unitKey: "temp_c", step: 0.1, min: 30, max: 45, hasMax: true },
  { key: "weight_kg", unitKey: "weight_kg", step: 0.1, min: 10, max: 300, hasMax: true },
  { key: "glucose_mmol", unitKey: "glucose_mmol", step: 0.1, min: 1, max: 50, hasMax: true },
];

const UNIT_KEYS = {
  bp: "vitals.units.bp",
  pulse: "vitals.units.pulse",
  spo2: "vitals.units.spo2",
  temp_c: "vitals.units.temp_c",
  weight_kg: "vitals.units.weight_kg",
  glucose_mmol: "vitals.units.glucose_mmol",
} as const;

function formatDateTime(d: string): string {
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

function isOutOfRange(value: number | undefined, range: ThresholdRange | undefined): boolean {
  if (value === undefined || !range) return false;
  if (range.min !== undefined && value < range.min) return true;
  if (range.max !== undefined && value > range.max) return true;
  return false;
}

function readingsOf(row: VitalsRow): VitalReadings {
  const r = row.readings as unknown as Partial<Record<VitalKey, unknown>>;
  const out: VitalReadings = {};
  for (const f of VITAL_FIELDS) {
    const v = r?.[f.key];
    if (typeof v === "number") out[f.key] = v;
  }
  return out;
}

export function VitalsTab({ residentId, branchId, staffId, logAction }: VitalsTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [days, setDays] = useState<number | null>(30);
  const { vitals, isLoading } = useVitals({ residentId, days });
  const { thresholds: thresholdsRow } = useVitalsThresholds(residentId);
  const thresholds: ThresholdMap = useMemo(
    () => (thresholdsRow?.thresholds as unknown as ThresholdMap) ?? {},
    [thresholdsRow],
  );

  // Form state
  const [recordOpen, setRecordOpen] = useState(true);
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [form, setForm] = useState<VitalReadings>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAbnormalWarning, setShowAbnormalWarning] = useState(false);

  // Threshold draft
  const [tDraft, setTDraft] = useState<ThresholdMap>({});
  const [savingThresholds, setSavingThresholds] = useState(false);
  useEffect(() => {
    setTDraft(thresholds);
  }, [thresholds]);

  const setVitalValue = (k: VitalKey, raw: string) => {
    setForm((f) => {
      const next = { ...f };
      if (raw === "") delete next[k];
      else {
        const n = Number(raw);
        if (!isNaN(n)) next[k] = n;
      }
      return next;
    });
  };

  const setThresholdValue = (k: VitalKey, side: "min" | "max", raw: string) => {
    setTDraft((d) => {
      const next: ThresholdMap = { ...d };
      const range: ThresholdRange = { ...(next[k] ?? {}) };
      if (raw === "") delete range[side];
      else {
        const n = Number(raw);
        if (!isNaN(n)) range[side] = n;
      }
      if (range.min === undefined && range.max === undefined) delete next[k];
      else next[k] = range;
      return next;
    });
  };

  const handleRecord = async () => {
    if (!staffId) return;
    if (Object.keys(form).length === 0) return;
    setSaving(true);
    setErr(null);
    setShowAbnormalWarning(false);
    try {
      const isAbnormal = VITAL_FIELDS.some((f) => isOutOfRange(form[f.key], thresholds[f.key]));
      const insertRow: TablesInsert<"vitals"> = {
        resident_id: residentId,
        branch_id: branchId,
        recorded_by: staffId,
        recorded_at: new Date().toISOString(),
        readings: form as unknown as TablesInsert<"vitals">["readings"],
        is_abnormal: isAbnormal,
        alert_triggered: false,
        notes: notes.trim() || null,
      };
      const { data, error } = await supabase.from("vitals").insert(insertRow).select().single();
      if (error) throw error;
      await logAction({
        action: "VITALS_RECORDED",
        entity_type: "vitals",
        entity_id: data.id,
        branch_id: branchId,
        after_state: { readings: form, is_abnormal: isAbnormal } as Record<string, unknown>,
      });

      if (isAbnormal) {
        const abnormalReadings = VITAL_FIELDS
          .filter((f) => isOutOfRange(form[f.key], thresholds[f.key]))
          .map((f) => f.key);

        const alertInsert: TablesInsert<"alerts"> = {
          branch_id: branchId,
          resident_id: residentId,
          source: "VITALS",
          source_ref_id: data.id,
          source_ref_table: "vitals",
          type: "VITALS_BREACH",
          severity: "HIGH",
          status: "OPEN",
          triggered_at: new Date().toISOString(),
        };
        const { data: alertData, error: alertErr } = await supabase
          .from("alerts")
          .insert(alertInsert)
          .select()
          .single();
        if (alertErr) {
          // eslint-disable-next-line no-console
          console.error("[alerts] insert failed:", alertErr.message);
        } else {
          await supabase
            .from("vitals")
            .update({ alert_triggered: true })
            .eq("id", data.id);
          await logAction({
            action: "ALERT_CREATED",
            entity_type: "alerts",
            entity_id: alertData.id,
            branch_id: branchId,
            metadata: {
              source: "VITALS",
              abnormal_readings: abnormalReadings,
              resident_id: residentId,
            },
          });
          void qc.invalidateQueries({ queryKey: ["alerts", branchId] });
          void qc.invalidateQueries({ queryKey: ["alerts"] });
          toast.success(t("alerts.vitalsBreachAlert"));
        }
      }

      toast.success(t("vitals.recordSuccess"));
      if (isAbnormal) setShowAbnormalWarning(true);
      void qc.invalidateQueries({ queryKey: ["vitals", residentId] });
      setForm({});
      setNotes("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThresholds = async () => {
    if (!staffId) return;
    setSavingThresholds(true);
    try {
      const before = thresholds;
      const { error } = await supabase
        .from("vitals_thresholds")
        .upsert(
          {
            resident_id: residentId,
            branch_id: branchId,
            thresholds: tDraft as unknown as TablesInsert<"vitals_thresholds">["thresholds"],
            set_by: staffId,
          },
          { onConflict: "resident_id" },
        );
      if (error) throw error;
      await logAction({
        action: "VITALS_THRESHOLDS_SET",
        entity_type: "vitals_thresholds",
        entity_id: residentId,
        branch_id: branchId,
        before_state: before as Record<string, unknown>,
        after_state: tDraft as Record<string, unknown>,
      });
      toast.success(t("vitals.thresholdSaved"));
      void qc.invalidateQueries({ queryKey: ["vitalsThresholds", residentId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingThresholds(false);
    }
  };

  const allEmpty = Object.keys(form).length === 0;

  return (
    <Stack gap={4} data-feedback-id="resident-tab-vitals">
      {/* Section 1: Record */}
      <Card padding="md">
        <Stack gap={3}>
          <button
            type="button"
            onClick={() => setRecordOpen((o) => !o)}
            className="flex items-center gap-2 text-left"
            style={{ color: "var(--text-primary)" }}
          >
            {recordOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Heading level={3}>{t("vitals.record")}</Heading>
          </button>

          {recordOpen && (
            <>
              <Surface padding="sm" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <Inline gap={2} align="center">
                  <span style={{ color: "var(--text-tertiary)" }}><WifiOff size={16} /></span>
                  <Text size="sm" color="secondary">{t("vitals.iotHint")}</Text>
                </Inline>
              </Surface>

              {err && <Alert severity="error" description={err} />}
              {showAbnormalWarning && (
                <Alert severity="warning" description={t("vitals.abnormalWarning")} onDismiss={() => setShowAbnormalWarning(false)} />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                {VITAL_FIELDS.map((f) => (
                  <FormField key={f.key} label={`${t(`vitals.readings.${f.key}`)} (${t(UNIT_KEYS[f.unitKey])})`}>
                    <TextField
                      type="number"
                      step={f.step}
                      min={f.min}
                      max={f.max}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setVitalValue(f.key, e.target.value)}
                    />
                  </FormField>
                ))}
              </div>

              <FormField label={t("vitals.notes")}>
                <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormField>

              <Inline justify="end">
                <Button variant="primary" loading={saving} onClick={handleRecord} disabled={allEmpty || !staffId}>
                  {t("vitals.record")}
                </Button>
              </Inline>
            </>
          )}
        </Stack>
      </Card>

      {/* Section 2: History */}
      <Card padding="md">
        <Stack gap={3}>
          <Inline justify="between" align="center">
            <Heading level={3}>{t("vitals.history")}</Heading>
            <div style={{ width: 180 }}>
              <Select
                value={days === null ? "all" : String(days)}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value;
                  setDays(v === "all" ? null : Number(v));
                }}
                options={[
                  { value: "7", label: t("vitals.last7days") },
                  { value: "30", label: t("vitals.last30days") },
                  { value: "all", label: t("vitals.allTime") },
                ]}
              />
            </div>
          </Inline>

          {isLoading ? (
            <div className="flex items-center justify-center" style={{ minHeight: 160 }}>
              <Spinner size="md" />
            </div>
          ) : vitals.length === 0 ? (
            <EmptyState title={t("vitals.noReadings")} />
          ) : (
            <div className="w-full overflow-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <Th>{t("vitals.recordedAt")}</Th>
                    <Th>{t("vitals.readings.bp_systolic")}</Th>
                    <Th>{t("vitals.readings.bp_diastolic")}</Th>
                    <Th>{t("vitals.readings.pulse")}</Th>
                    <Th>{t("vitals.readings.spo2")}</Th>
                    <Th>{t("vitals.readings.temp_c")}</Th>
                    <Th>{t("vitals.readings.glucose_mmol")}</Th>
                    <Th>{t("residents.columns.status")}</Th>
                    <Th>{t("vitals.recordedBy")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((row) => {
                    const r = readingsOf(row);
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <Td>{formatDateTime(row.recorded_at)}</Td>
                        <ReadingTd value={r.bp_systolic} unit="mmHg" range={thresholds.bp_systolic} />
                        <ReadingTd value={r.bp_diastolic} unit="mmHg" range={thresholds.bp_diastolic} />
                        <ReadingTd value={r.pulse} unit={t("vitals.units.pulse")} range={thresholds.pulse} />
                        <ReadingTd value={r.spo2} unit="%" range={thresholds.spo2} />
                        <ReadingTd value={r.temp_c} unit="°C" range={thresholds.temp_c} />
                        <ReadingTd value={r.glucose_mmol} unit="mmol/L" range={thresholds.glucose_mmol} />
                        <Td>
                          <Badge tone={row.is_abnormal ? "error" : "success"}>
                            {row.is_abnormal ? t("vitals.abnormal") : t("vitals.normal")}
                          </Badge>
                        </Td>
                        <Td>{row.recorder?.name_zh ?? row.recorder?.name ?? "—"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      </Card>

      {/* Section 3: Threshold Configuration */}
      <Card padding="md">
        <Stack gap={3}>
          <button
            type="button"
            onClick={() => setThresholdOpen((o) => !o)}
            className="flex items-center gap-2 text-left"
            style={{ color: "var(--text-primary)" }}
          >
            {thresholdOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Heading level={3}>{t("vitals.thresholds")}</Heading>
          </button>

          {thresholdOpen && (
            <>
              <Text size="sm" color="tertiary">{t("vitals.thresholdHint")}</Text>
              <Divider />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                {VITAL_FIELDS.map((f) => (
                  <Surface key={f.key} padding="sm">
                    <Stack gap={2}>
                      <Text size="sm" className="font-semibold">
                        {t(`vitals.readings.${f.key}`)} ({t(UNIT_KEYS[f.unitKey])})
                      </Text>
                      <Inline gap={2} className="w-full">
                        <div className="flex-1">
                          <FormField label={t("vitals.min")}>
                            <TextField
                              type="number"
                              step={f.step}
                              value={tDraft[f.key]?.min ?? ""}
                              onChange={(e) => setThresholdValue(f.key, "min", e.target.value)}
                            />
                          </FormField>
                        </div>
                        {f.hasMax && (
                          <div className="flex-1">
                            <FormField label={t("vitals.max")}>
                              <TextField
                                type="number"
                                step={f.step}
                                value={tDraft[f.key]?.max ?? ""}
                                onChange={(e) => setThresholdValue(f.key, "max", e.target.value)}
                              />
                            </FormField>
                          </div>
                        )}
                      </Inline>
                    </Stack>
                  </Surface>
                ))}
              </div>
              <Inline justify="end">
                <Button variant="primary" loading={savingThresholds} onClick={handleSaveThresholds} disabled={!staffId}>
                  {t("vitals.saveThresholds")}
                </Button>
              </Inline>
            </>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left type-label"
      style={{ padding: "10px 12px", color: "var(--text-tertiary)", fontWeight: 500 }}
    >
      {children}
    </th>
  );
}

function Td({ children, abnormal }: { children: React.ReactNode; abnormal?: boolean }) {
  return (
    <td
      className="type-body-sm"
      style={{
        padding: "10px 12px",
        color: abnormal ? "var(--status-error-accent)" : "var(--text-primary)",
        fontWeight: abnormal ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}

function ReadingTd({ value, unit, range }: { value: number | undefined; unit: string; range: ThresholdRange | undefined }) {
  if (value === undefined) return <Td>—</Td>;
  const abnormal = isOutOfRange(value, range);
  return <Td abnormal={abnormal}>{value} {unit}</Td>;
}
