import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Stack, FormField, NumberField, Switch, Button, Text, Skeleton, Select } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { useAuditLog } from "@/hooks/useAuditLog";

interface EmarConfig {
  emar_pass_window_before?: number;
  emar_pass_window_after?: number;
  emar_pin_lockout_attempts?: number;
  emar_prn_indication_required?: boolean;
  emar_prn_outcome_required?: boolean;
  [k: string]: unknown;
}

export function EmarConfigSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { branches, isLoading } = useBranches();
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const branch = branches.find((b) => b.id === selectedBranchId) ?? branches[0] ?? null;

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const [before, setBefore] = useState(60);
  const [after, setAfter] = useState(60);
  const [lockout, setLockout] = useState(3);
  const [prnInd, setPrnInd] = useState(true);
  const [prnOut, setPrnOut] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cfg = (branch?.sla_config as EmarConfig | null) ?? {};
    setBefore(cfg.emar_pass_window_before ?? 60);
    setAfter(cfg.emar_pass_window_after ?? 60);
    setLockout(cfg.emar_pin_lockout_attempts ?? 3);
    setPrnInd(cfg.emar_prn_indication_required ?? true);
    setPrnOut(cfg.emar_prn_outcome_required ?? true);
  }, [branch?.id, branch?.sla_config]);

  if (isLoading) return <Card padding="lg"><Skeleton height={120} /></Card>;
  if (!branch) return <Card padding="lg"><Text size="sm" color="secondary">{t("common.loading")}</Text></Card>;

  const save = async () => {
    setBusy(true);
    try {
      const beforeCfg = (branch.sla_config as EmarConfig | null) ?? {};
      const newCfg: EmarConfig = {
        ...beforeCfg,
        emar_pass_window_before: before,
        emar_pass_window_after: after,
        emar_pin_lockout_attempts: lockout,
        emar_prn_indication_required: prnInd,
        emar_prn_outcome_required: prnOut,
      };
      const { error } = await supabase.from("branches").update({ sla_config: newCfg as never }).eq("id", branch.id);
      if (error) throw error;
      await logAction({
        action: "SETTINGS_UPDATE", entity_type: "branch_settings", entity_id: branch.id, branch_id: branch.id,
        before_state: { sla_config: beforeCfg }, after_state: { sla_config: newCfg },
      });
      toast.success(t("common.saved"));
      void qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card padding="md">
      <Stack gap={4}>
        <Text size="md" className="font-semibold">{t("settings.emar.title")}</Text>
        {branches.length > 1 && (
          <FormField label={t("settings.emar.configBranch")}>
            <Select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId((e.target as HTMLSelectElement).value)}
              options={branches.map((b) => ({ value: b.id, label: b.name_zh ? `${b.name_zh} (${b.name})` : b.name }))}
            />
          </FormField>
        )}
        <FormField label={t("settings.emar.passWindowBefore")}>
          <NumberField numericValue={before} onValueChange={setBefore} unit="min" step={5} min={0} />
        </FormField>
        <FormField label={t("settings.emar.passWindowAfter")}>
          <NumberField numericValue={after} onValueChange={setAfter} unit="min" step={5} min={0} />
        </FormField>
        <FormField label={t("settings.emar.pinLockoutAttempts")}>
          <NumberField numericValue={lockout} onValueChange={(v) => setLockout(Math.max(1, Math.min(10, v)))} step={1} min={1} />
        </FormField>
        <Switch checked={prnInd} onChange={setPrnInd} label={t("settings.emar.prnIndicationRequired")} />
        <Switch checked={prnOut} onChange={setPrnOut} label={t("settings.emar.prnOutcomeRequired")} />
        <div>
          <Button variant="primary" onClick={save} disabled={busy}>{t("actions.save")}</Button>
        </div>
      </Stack>
    </Card>
  );
}
