import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Card, Stack, Inline, Text, Badge, Button, EmptyState, Skeleton, Avatar, PageHeader, Heading,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAlerts, type AlertRow } from "@/hooks/useAlerts";
import type { Tables, Enums } from "@/integrations/supabase/types";

type AbnormalVital = Tables<"vitals"> & {
  residents: { id: string; name: string; name_zh: string } | null;
};
type AlertStatus = Enums<"alert_status">;

function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

function VitalsDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { branches } = useBranches();
  const { staff } = useCurrentStaff();
  const { logAction } = useAuditLog();
  const branchId = branches[0]?.id ?? null;

  const [abnormal, setAbnormal] = useState<AbnormalVital[]>([]);
  const [loadingAbnormal, setLoadingAbnormal] = useState(true);

  const { alerts, isLoading: loadingAlerts } = useAlerts({ branchId, status: "OPEN", page: 1, pageSize: 100 });
  const vitalsAlerts = useMemo(() => alerts.filter((a) => a.type === "VITALS_BREACH"), [alerts]);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    (async () => {
      setLoadingAbnormal(true);
      const { data, error } = await supabase
        .from("vitals")
        .select("*, residents:resident_id(id, name, name_zh)")
        .eq("branch_id", branchId)
        .eq("is_abnormal", true)
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        if (!error) setAbnormal((data ?? []) as unknown as AbnormalVital[]);
        setLoadingAbnormal(false);
      }
    })();
    return () => { cancelled = true; };
  }, [branchId]);

  const handleAcknowledge = async (a: AlertRow) => {
    if (!staff?.id || !branchId) return;
    const after = { status: "ACKNOWLEDGED" as AlertStatus, acknowledged_by: staff.id, acknowledged_at: new Date().toISOString() };
    const { error } = await supabase.from("alerts").update(after).eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction({
      action: "ALERT_ACKNOWLEDGED",
      entity_type: "alerts",
      entity_id: a.id,
      branch_id: branchId,
      before_state: { status: a.status },
      after_state: after,
    });
    toast.success(t("alerts.acknowledgeSuccess"));
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("nav.vitals")}>
        <Stack gap={4}>
          <PageHeader title={t("vitals.dashboardTitle")} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* LEFT: Recent Abnormal Vitals */}
            <Card padding="md">
              <Stack gap={3}>
                <Heading level={3}>{t("vitals.recentAbnormal")}</Heading>
                {loadingAbnormal ? (
                  <Stack gap={2}>
                    <Skeleton variant="row" />
                    <Skeleton variant="row" />
                    <Skeleton variant="row" />
                  </Stack>
                ) : abnormal.length === 0 ? (
                  <EmptyState title={t("vitals.noRecentAbnormal")} />
                ) : (
                  <Stack gap={2}>
                    {abnormal.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => row.residents && navigate({ to: "/residents/$id", params: { id: row.residents.id } })}
                        className="w-full text-left rounded transition-colors hover:bg-[var(--bg-hover-subtle)]"
                        style={{ padding: 12, border: "1px solid var(--border-subtle)" }}
                      >
                        <Inline justify="between" align="center" className="w-full">
                          <Inline gap={2} align="center">
                            <Avatar size="sm" name={row.residents?.name_zh ?? row.residents?.name ?? "?"} />
                            <Stack gap={1}>
                              <Text size="sm" className="font-semibold">
                                {row.residents?.name_zh ?? row.residents?.name ?? "—"}
                              </Text>
                              <Text size="caption" color="tertiary">{formatDateTime(row.recorded_at)}</Text>
                            </Stack>
                          </Inline>
                          <Badge tone="error">{t("vitals.abnormal")}</Badge>
                        </Inline>
                      </button>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>

            {/* RIGHT: Open VITALS_BREACH alerts */}
            <Card padding="md">
              <Stack gap={3}>
                <Heading level={3}>{t("alerts.open")}</Heading>
                {loadingAlerts ? (
                  <Stack gap={2}>
                    <Skeleton variant="row" />
                    <Skeleton variant="row" />
                    <Skeleton variant="row" />
                  </Stack>
                ) : vitalsAlerts.length === 0 ? (
                  <EmptyState title={t("alerts.noAlerts")} />
                ) : (
                  <Stack gap={2}>
                    {vitalsAlerts.map((a) => (
                      <div
                        key={a.id}
                        className="rounded"
                        style={{ padding: 12, border: "1px solid var(--border-subtle)" }}
                      >
                        <Inline justify="between" align="center" className="w-full">
                          <Stack gap={1}>
                            <Text size="sm" className="font-semibold">
                              {a.residents ? (a.residents.name_zh || a.residents.name) : "—"}
                            </Text>
                            <Text size="caption" color="tertiary">{formatDateTime(a.triggered_at)}</Text>
                          </Stack>
                          {staff?.id && (
                            <Button variant="primary" size="compact" onClick={() => handleAcknowledge(a)}>
                              {t("alerts.acknowledge")}
                            </Button>
                          )}
                        </Inline>
                      </div>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          </div>
        </Stack>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/vitals")({
  component: VitalsDashboardPage,
});
