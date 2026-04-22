import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, Select, Switch, Stack, Inline, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface NewOrderModalProps {
  open: boolean;
  onClose: () => void;
  residentId: string;
  branchId: string;
  staffId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

const ROUTES = ["ORAL", "IV", "IM", "SC", "TOPICAL", "INHALED", "OTHER"] as const;
const FREQUENCIES = ["ONCE_DAILY", "TWICE_DAILY", "THREE_DAILY", "FOUR_DAILY"] as const;

type Route = (typeof ROUTES)[number];
type Frequency = (typeof FREQUENCIES)[number];

function defaultTimes(freq: Frequency): string[] {
  switch (freq) {
    case "ONCE_DAILY": return ["08:00"];
    case "TWICE_DAILY": return ["08:00", "20:00"];
    case "THREE_DAILY": return ["08:00", "14:00", "20:00"];
    case "FOUR_DAILY": return ["08:00", "12:00", "16:00", "20:00"];
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewOrderModal({
  open, onClose, residentId, branchId, staffId, logAction,
}: NewOrderModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [drugName, setDrugName] = useState("");
  const [drugNameZh, setDrugNameZh] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState<Route>("ORAL");
  const [isPRN, setIsPRN] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("ONCE_DAILY");
  const [times, setTimes] = useState<string[]>(defaultTimes("ONCE_DAILY"));
  const [prnIndication, setPrnIndication] = useState("");
  const [barcode, setBarcode] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDrugName("");
      setDrugNameZh("");
      setDose("");
      setRoute("ORAL");
      setIsPRN(false);
      setFrequency("ONCE_DAILY");
      setTimes(defaultTimes("ONCE_DAILY"));
      setPrnIndication("");
      setBarcode("");
      setStartDate(todayISO());
      setEndDate("");
      setErr(null);
    }
  }, [open]);

  const handleFreqChange = (f: Frequency) => {
    setFrequency(f);
    setTimes(defaultTimes(f));
  };

  const handleTimeChange = (idx: number, value: string) => {
    setTimes((cur) => cur.map((tm, i) => (i === idx ? value : tm)));
  };

  const handleSave = async () => {
    if (!drugName.trim() || !dose.trim()) {
      setErr(t("emar.drug"));
      return;
    }
    if (isPRN && !prnIndication.trim()) {
      setErr(t("emar.prnIndication"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const today = todayISO();
      const orderInsert: TablesInsert<"medication_orders"> = {
        resident_id: residentId,
        branch_id: branchId,
        drug_name: drugName.trim(),
        drug_name_zh: drugNameZh.trim() || null,
        dose: dose.trim(),
        route,
        frequency: isPRN ? "PRN" : frequency,
        schedule: isPRN ? null : { times },
        is_prn: isPRN,
        prn_indication: isPRN ? prnIndication.trim() : null,
        barcode: barcode.trim() || null,
        ordered_by: staffId,
        start_date: startDate,
        end_date: endDate || null,
        status: "ACTIVE",
      };
      const { data: order, error: orderErr } = await supabase
        .from("medication_orders")
        .insert(orderInsert)
        .select()
        .single();
      if (orderErr) throw orderErr;

      // Auto-generate today's eMAR records (PRN excluded)
      if (!isPRN && startDate <= today && (!endDate || endDate >= today)) {
        const emarRows: TablesInsert<"emar_records">[] = times.map((tm) => ({
          order_id: order.id,
          resident_id: residentId,
          branch_id: branchId,
          due_at: new Date(`${today}T${tm}:00`).toISOString(),
          status: "DUE",
        }));
        if (emarRows.length > 0) {
          const { error: emarErr } = await supabase.from("emar_records").insert(emarRows);
          if (emarErr) throw emarErr;
        }
      }

      await logAction({
        action: "MEDICATION_ORDER_CREATED",
        entity_type: "medication_orders",
        entity_id: order.id,
        branch_id: branchId,
        after_state: order as unknown as Record<string, unknown>,
      });

      void qc.invalidateQueries({ queryKey: ["medicationOrders", residentId] });
      void qc.invalidateQueries({ queryKey: ["emarRecords", residentId, today] });
      toast.success(t("emar.orderCreated"));
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
      title={t("emar.newOrder")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>{t("actions.save")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        {err && <Alert severity="error" description={err} />}
        <Inline gap={3} align="start" className="w-full">
          <div style={{ flex: 1 }}>
            <FormField label={t("emar.drug")} required>
              <TextField value={drugName} onChange={(e) => setDrugName(e.target.value)} />
            </FormField>
          </div>
          <div style={{ flex: 1 }}>
            <FormField label={t("emar.drugZh")}>
              <TextField value={drugNameZh} onChange={(e) => setDrugNameZh(e.target.value)} />
            </FormField>
          </div>
        </Inline>

        <Inline gap={3} align="start" className="w-full">
          <div style={{ flex: 1 }}>
            <FormField label={t("emar.dose")} required>
              <TextField placeholder="e.g. 500mg" value={dose} onChange={(e) => setDose(e.target.value)} />
            </FormField>
          </div>
          <div style={{ flex: 1 }}>
            <FormField label={t("emar.route")} required>
              <Select
                value={route}
                onChange={(e) => setRoute((e.target as HTMLSelectElement).value as Route)}
                options={ROUTES.map((r) => ({ value: r, label: t(`emar.routes.${r}`) }))}
              />
            </FormField>
          </div>
        </Inline>

        <FormField label={t("emar.isPRN")}>
          <Switch checked={isPRN} onChange={setIsPRN} label={t("emar.isPRN")} />
        </FormField>

        {!isPRN && (
          <>
            <FormField label={t("emar.frequency")} required>
              <Select
                value={frequency}
                onChange={(e) => handleFreqChange((e.target as HTMLSelectElement).value as Frequency)}
                options={FREQUENCIES.map((f) => ({ value: f, label: t(`emar.frequencies.${f}`) }))}
              />
            </FormField>
            <FormField label={t("emar.schedule_times")}>
              <Inline gap={2} wrap>
                {times.map((tm, idx) => (
                  <div key={idx} style={{ width: 120 }}>
                    <TextField
                      type="time"
                      value={tm}
                      onChange={(e) => handleTimeChange(idx, e.target.value)}
                    />
                  </div>
                ))}
              </Inline>
            </FormField>
          </>
        )}

        {isPRN && (
          <FormField label={t("emar.prnIndication")} required>
            <TextField value={prnIndication} onChange={(e) => setPrnIndication(e.target.value)} />
          </FormField>
        )}

        <FormField label={t("emar.barcode")} helper={t("emar.barcodeHint")}>
          <TextField value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </FormField>

        <Inline gap={3} align="start" className="w-full">
          <div style={{ flex: 1 }}>
            <FormField label={t("emar.startDate")} required>
              <TextField type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
          </div>
          <div style={{ flex: 1 }}>
            <FormField label={t("emar.endDate")}>
              <TextField type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
          </div>
        </Inline>
      </Stack>
    </Modal>
  );
}
