import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Drawer, Stack, Inline, Text, Badge, Card, EmptyState, Skeleton } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateTime } from "./timeUtils";

type EscalationRow = Tables<"alert_escalations">;

interface EscalationHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  alertId: string | null;
}

export function EscalationHistoryDrawer({ open, onClose, alertId }: EscalationHistoryDrawerProps) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["alert_escalations", alertId],
    enabled: open && !!alertId,
    queryFn: async (): Promise<EscalationRow[]> => {
      if (!alertId) return [];
      const { data, error } = await supabase
        .from("alert_escalations")
        .select("*")
        .eq("alert_id", alertId)
        .order("escalated_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EscalationRow[];
    },
  });

  const rows = data ?? [];

  return (
    <Drawer open={open} onClose={onClose} title={t("alerts.escalationHistory")} width={480}>
      {isLoading ? (
        <Stack gap={2}>
          <Skeleton variant="row" />
          <Skeleton variant="row" />
        </Stack>
      ) : rows.length === 0 ? (
        <EmptyState title={t("alerts.noEscalationHistory")} />
      ) : (
        <Stack gap={3}>
          {rows.map((r) => (
            <Card key={r.id} padding="md">
              <Stack gap={2}>
                <Inline gap={2} align="center" wrap>
                  <Text size="sm" color="tertiary">{t("alerts.fromLevel")}</Text>
                  <Badge tone="neutral">Lv.{r.from_level}</Badge>
                  <Text size="sm" color="tertiary">{t("alerts.toLevel")}</Text>
                  <Badge tone="error">Lv.{r.to_level}</Badge>
                </Inline>
                <Text size="sm" color="secondary">{formatDateTime(r.escalated_at)}</Text>
                <Text size="sm">{r.reason}</Text>
                <Inline gap={1} align="center" wrap>
                  <Text size="caption" color="tertiary">{t("alerts.notifiedStaff")}:</Text>
                  {(r.notified_staff ?? []).length === 0 ? (
                    <Text size="caption" color="tertiary">—</Text>
                  ) : (
                    (r.notified_staff ?? []).map((_s, idx) => (
                      <Badge key={idx} tone="info">{t("alerts.assignToSelf")}</Badge>
                    ))
                  )}
                </Inline>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Drawer>
  );
}
