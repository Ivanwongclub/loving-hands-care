import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { Card, Stack, Inline, Text, Badge, Button, Spinner, Surface, Divider } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";

interface EscalationEngineCardProps {
  branchId: string | null;
}

const DAY_MS = 86_400_000;

export function EscalationEngineCard({ branchId }: EscalationEngineCardProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const sinceIso = new Date(Date.now() - DAY_MS).toISOString();

  const autoCount = useQuery({
    queryKey: ["audit-counts", "ALERT_AUTO_ESCALATED", branchId, "24h"],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return 0;
      const { count, error } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("action", "ALERT_AUTO_ESCALATED")
        .gte("created_at", sinceIso);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const manualCount = useQuery({
    queryKey: ["audit-counts", "ALERT_ESCALATED", branchId, "24h"],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return 0;
      const { count, error } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("action", "ALERT_ESCALATED")
        .gte("created_at", sinceIso);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("alert-escalation-worker", {
        body: {},
      });
      if (error) throw error;
      const escalated = (data as { escalated?: number } | null)?.escalated ?? 0;
      toast.success(`${t("alerts.runNowSuccess")} (${escalated})`);
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["audit-counts"] });
    } catch (err) {
      toast.error(`${t("alerts.runNowError")}: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Stack gap={3}>
      <Card padding="md">
        <Stack gap={3}>
          <Inline justify="between" align="center" wrap>
            <Inline gap={2} align="center">
              <Zap size={18} style={{ color: "var(--status-success-accent)" }} />
              <Text size="md" className="font-semibold">{t("alerts.escalationEngine")}</Text>
              <Badge tone="success">{t("alerts.engineActive")}</Badge>
            </Inline>
            <Button
              variant="primary"
              size="compact"
              onClick={handleRunNow}
              disabled={running || !branchId}
              leadingIcon={running ? <Spinner size="sm" /> : undefined}
            >
              {t("alerts.runNow")}
            </Button>
          </Inline>
          <Text size="sm" color="secondary">{t("alerts.escalationEngineDesc")}</Text>

          <Divider />

          <Inline gap={6} wrap>
            <Stack gap={1}>
              <Text size="caption" color="tertiary">{t("alerts.totalAutoEscalated")}</Text>
              <Text size="lg" className="font-semibold">{autoCount.data ?? "—"}</Text>
            </Stack>
            <Stack gap={1}>
              <Text size="caption" color="tertiary">{t("alerts.manualEscalated")}</Text>
              <Text size="lg" className="font-semibold">{manualCount.data ?? "—"}</Text>
            </Stack>
          </Inline>
        </Stack>
      </Card>

      <Surface padding="sm" style={{ backgroundColor: "var(--bg-subtle)" }}>
        <Stack gap={1}>
          <Text size="sm" color="secondary">{t("alerts.cronScheduleNote")}</Text>
          <Text size="caption" color="tertiary">{t("alerts.cronScheduleHint")}</Text>
        </Stack>
      </Surface>
    </Stack>
  );
}
