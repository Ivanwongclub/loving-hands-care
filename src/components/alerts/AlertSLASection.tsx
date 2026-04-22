import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Stack, FormField, NumberField, Button, Text, HelperText } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuditLog } from "@/hooks/useAuditLog";
import { readSLA } from "@/components/alerts/timeUtils";

interface AlertSLASectionProps {
  branch: Tables<"branches"> | null;
}

export function AlertSLASection({ branch }: AlertSLASectionProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();

  const initial = readSLA(branch?.sla_config);
  const [l1, setL1] = useState(initial.alert_escalation_l1_minutes);
  const [l2, setL2] = useState(initial.alert_escalation_l2_minutes);
  const [l3, setL3] = useState(initial.alert_escalation_l3_minutes);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = readSLA(branch?.sla_config);
    setL1(s.alert_escalation_l1_minutes);
    setL2(s.alert_escalation_l2_minutes);
    setL3(s.alert_escalation_l3_minutes);
  }, [branch?.id, branch?.sla_config]);

  if (!branch) {
    return (
      <Card padding="lg">
        <Text size="sm" color="secondary">{t("common.loading")}</Text>
      </Card>
    );
  }

  const handleSave = async () => {
    setBusy(true);
    try {
      const before = { sla_config: branch.sla_config };
      const newCfg = {
        ...(branch.sla_config as Record<string, unknown> | null ?? {}),
        alert_escalation_l1_minutes: l1,
        alert_escalation_l2_minutes: l2,
        alert_escalation_l3_minutes: l3,
      };
      const { error } = await supabase
        .from("branches")
        .update({ sla_config: newCfg })
        .eq("id", branch.id);
      if (error) throw error;

      await logAction({
        action: "SLA_CONFIG_UPDATED",
        entity_type: "branches",
        entity_id: branch.id,
        branch_id: branch.id,
        before_state: before,
        after_state: { sla_config: newCfg },
      });
      toast.success(t("alerts.slaSaveSuccess"));
      void qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="md">
      <Stack gap={4}>
        <Text size="md" className="font-semibold">{t("alerts.slaConfig")}</Text>
        <HelperText>{t("alerts.slaDescription")}</HelperText>
        <FormField label={t("alerts.slaLevel1")}>
          <NumberField numericValue={l1} onValueChange={setL1} unit="min" step={5} min={1} />
        </FormField>
        <FormField label={t("alerts.slaLevel2")}>
          <NumberField numericValue={l2} onValueChange={setL2} unit="min" step={5} min={1} />
        </FormField>
        <FormField label={t("alerts.slaLevel3")}>
          <NumberField numericValue={l3} onValueChange={setL3} unit="min" step={5} min={1} />
        </FormField>
        <div>
          <Button variant="primary" onClick={handleSave} disabled={busy}>
            {t("actions.save")}
          </Button>
        </div>
      </Stack>
    </Card>
  );
}
