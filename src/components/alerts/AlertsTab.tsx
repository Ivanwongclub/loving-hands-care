import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import { toast } from "sonner";
import {
  Card, Stack, Inline, Text, Heading, Button, Badge, EmptyState, Skeleton, Select, FormField,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { useAlerts, type AlertRow } from "@/hooks/useAlerts";
import type { useAuditLog } from "@/hooks/useAuditLog";
import { EscalateModal } from "./EscalateModal";
import { ResolveModal } from "./ResolveModal";
import { AssignModal } from "./AssignModal";
import { EscalationHistoryDrawer } from "./EscalationHistoryDrawer";

type AlertSource = Enums<"alert_source">;
type AlertSeverity = Enums<"alert_severity">;
type AlertStatus = Enums<"alert_status">;

const SOURCE_TONE: Record<AlertSource, "info" | "warning" | "neutral"> = {
  VITALS: "info",
  INCIDENT: "warning",
  MANUAL: "neutral",
  SYSTEM: "neutral",
  IOT: "info",
};

const SEVERITY_TONE: Record<AlertSeverity, "success" | "warning" | "error"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error",
  CRITICAL: "error",
};

const STATUS_TONE: Record<AlertStatus, "warning" | "info" | "success" | "neutral"> = {
  OPEN: "warning",
  ACKNOWLEDGED: "info",
  ASSIGNED: "info",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

interface AlertsTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

export function AlertsTab({ residentId, branchId, staffId, logAction }: AlertsTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [escalateAlert, setEscalateAlert] = useState<AlertRow | null>(null);
  const [resolveAlert, setResolveAlert] = useState<AlertRow | null>(null);
  const [assignAlert, setAssignAlert] = useState<AlertRow | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const { alerts, isLoading } = useAlerts({ branchId, status: "ALL", page: 1, pageSize: 200 });

  const scoped = useMemo(
    () => alerts.filter((a) => a.resident_id === residentId),
    [alerts, residentId],
  );

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return scoped;
    return scoped.filter((a) => a.status === statusFilter);
  }, [scoped, statusFilter]);

  const handleAcknowledge = async (alertRow: AlertRow) => {
    if (!staffId) return;
    const before = { status: alertRow.status, acknowledged_by: alertRow.acknowledged_by, acknowledged_at: alertRow.acknowledged_at };
    const after = { status: "ACKNOWLEDGED" as AlertStatus, acknowledged_by: staffId, acknowledged_at: new Date().toISOString() };
    const { error } = await supabase.from("alerts").update(after).eq("id", alertRow.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction({
      action: "ALERT_ACKNOWLEDGED",
      entity_type: "alerts",
      entity_id: alertRow.id,
      branch_id: branchId,
      before_state: before,
      after_state: after,
    });
    toast.success(t("alerts.acknowledgeSuccess"));
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const handleResolve = async (alertRow: AlertRow) => {
    if (!staffId) return;
    const before = { status: alertRow.status, resolved_by: alertRow.resolved_by, resolved_at: alertRow.resolved_at };
    const after = {
      status: "RESOLVED" as AlertStatus,
      resolved_by: staffId,
      resolved_at: new Date().toISOString(),
      resolution_notes: "Resolved by staff",
    };
    const { error } = await supabase.from("alerts").update(after).eq("id", alertRow.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction({
      action: "ALERT_RESOLVED",
      entity_type: "alerts",
      entity_id: alertRow.id,
      branch_id: branchId,
      before_state: before,
      after_state: after,
    });
    toast.success(t("alerts.resolveSuccess"));
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const handleDismiss = async (alertRow: AlertRow) => {
    if (!staffId) return;
    const before = { status: alertRow.status };
    const after = { status: "DISMISSED" as AlertStatus };
    const { error } = await supabase.from("alerts").update(after).eq("id", alertRow.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction({
      action: "ALERT_DISMISSED",
      entity_type: "alerts",
      entity_id: alertRow.id,
      branch_id: branchId,
      before_state: before,
      after_state: after,
    });
    toast.success(t("alerts.dismissSuccess"));
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  return (
    <Stack gap={4}>
      <Inline justify="between" align="center">
        <Heading level={3}>{t("alerts.title")}</Heading>
        <div style={{ width: 220 }}>
          <FormField label={t("alerts.filterStatus")}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
              options={[
                { value: "ALL", label: t("alerts.allStatuses") },
                { value: "OPEN", label: t("alerts.status.OPEN") },
                { value: "ACKNOWLEDGED", label: t("alerts.status.ACKNOWLEDGED") },
                { value: "RESOLVED", label: t("alerts.status.RESOLVED") },
                { value: "DISMISSED", label: t("alerts.status.DISMISSED") },
              ]}
            />
          </FormField>
        </div>
      </Inline>

      {isLoading ? (
        <Stack gap={2}>
          <Skeleton variant="row" />
          <Skeleton variant="row" />
          <Skeleton variant="row" />
        </Stack>
      ) : filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState title={t("alerts.noAlerts")} />
        </Card>
      ) : (
        <Stack gap={3}>
          {filtered.map((a) => (
            <Card key={a.id} padding="md">
              <Stack gap={3}>
                <Inline justify="between" align="start" className="w-full" wrap>
                  <Inline gap={2} wrap align="center">
                    <Badge tone={SOURCE_TONE[a.source]}>{t(`alerts.source.${a.source}`)}</Badge>
                    <Text size="sm" className="font-semibold">
                      {a.type === "VITALS_BREACH" ? t("alerts.type.VITALS_BREACH") : a.type}
                    </Text>
                    <Badge tone={SEVERITY_TONE[a.severity]} emphasis={a.severity === "CRITICAL" ? "strong" : "subtle"}>
                      {t(`alerts.severity.${a.severity}`)}
                    </Badge>
                    <Badge tone={STATUS_TONE[a.status]}>{t(`alerts.status.${a.status}`)}</Badge>
                  </Inline>
                </Inline>

                <Text size="sm" color="secondary">{formatDateTime(a.triggered_at)}</Text>

                {a.status === "OPEN" && staffId && (
                  <Inline gap={2} justify="end">
                    <Button variant="ghost" size="compact" onClick={() => handleDismiss(a)}>
                      {t("alerts.dismiss")}
                    </Button>
                    <Button variant="primary" size="compact" onClick={() => handleAcknowledge(a)}>
                      {t("alerts.acknowledge")}
                    </Button>
                  </Inline>
                )}
                {a.status === "ACKNOWLEDGED" && staffId && (
                  <Inline gap={2} justify="end">
                    <Button variant="primary" size="compact" onClick={() => handleResolve(a)}>
                      {t("alerts.resolve")}
                    </Button>
                  </Inline>
                )}
                {(a.status === "RESOLVED" || a.status === "DISMISSED") && (
                  <Text size="sm" color="tertiary">
                    {a.status === "RESOLVED" && a.resolver
                      ? `${t("alerts.resolved")} · ${a.resolver.name_zh ?? a.resolver.name} · ${formatDateTime(a.resolved_at)}`
                      : a.status === "DISMISSED"
                        ? t("alerts.status.DISMISSED")
                        : ""}
                  </Text>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
