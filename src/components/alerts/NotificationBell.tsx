import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Drawer, Stack, Inline, Text, Badge, EmptyState, Button } from "@/components/hms";
import { useAuth } from "@/lib/AuthContext";
import { useAlerts, type AlertRow } from "@/hooks/useAlerts";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { timeAgo } from "./timeUtils";

type AlertSeverity = Enums<"alert_severity">;

const SEVERITY_TONE: Record<AlertSeverity, "success" | "warning" | "error"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error",
  CRITICAL: "error",
};

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { branches } = useBranches();
  const { staff } = useCurrentStaff();
  const { logAction } = useAuditLog();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const branchId = branches[0]?.id ?? null;

  const { alerts, refetch } = useAlerts({ branchId, status: "OPEN", page: 1, pageSize: 50 });

  useEffect(() => {
    const id = setInterval(() => {
      void refetch();
    }, 60_000);
    return () => clearInterval(id);
  }, [refetch]);

  if (!user) return null;

  const unread = alerts.length;
  const display = unread > 9 ? "9+" : String(unread);
  const recent = alerts.slice(0, 20);

  const handleMarkAllRead = async () => {
    if (!staff?.id || !branchId || alerts.length === 0) return;
    const nowIso = new Date().toISOString();
    const ids = alerts.map((a) => a.id);
    const { error } = await supabase
      .from("alerts")
      .update({ status: "ACKNOWLEDGED", acknowledged_by: staff.id, acknowledged_at: nowIso })
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    await Promise.all(
      alerts.map((a) =>
        logAction({
          action: "ALERT_ACKNOWLEDGED",
          entity_type: "alerts",
          entity_id: a.id,
          branch_id: branchId,
          before_state: { status: a.status },
          after_state: { status: "ACKNOWLEDGED", acknowledged_by: staff.id, acknowledged_at: nowIso },
          metadata: { bulk: true },
        }),
      ),
    );
    toast.success(t("alerts.markAllReadSuccess"));
    void qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("alerts.notificationBell")}
        onClick={() => setOpen(true)}
        className={`relative grid place-items-center hover:bg-[var(--bg-hover-subtle)] ${unread > 0 ? "animate-pulse" : ""}`}
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: "var(--radius-md)",
          backgroundColor: "transparent",
          border: "none",
          boxShadow: "none",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            className="absolute font-bold grid place-items-center"
            style={{
              top: -4,
              right: -4,
              width: 18,
              height: 18,
              borderRadius: "50%",
              backgroundColor: "var(--status-error-accent)",
              color: "var(--color-neutral-25, #fff)",
              fontSize: 10,
            }}
          >
            {display}
          </span>
        )}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("alerts.notificationBell")}
        width={360}
      >
        <Stack gap={3}>
          <Inline justify="between" align="center">
            <Text size="sm" color="secondary">
              {unread > 0 ? t("alerts.unreadCount", { count: unread }) : t("alerts.noNotifications")}
            </Text>
            {unread > 0 && (
              <Button variant="ghost" size="compact" onClick={handleMarkAllRead}>
                {t("alerts.markAllRead")}
              </Button>
            )}
          </Inline>

          {recent.length === 0 ? (
            <EmptyState title={t("alerts.noNotifications")} />
          ) : (
            <Stack gap={2}>
              {recent.map((a: AlertRow) => (
                <Link
                  key={a.id}
                  to="/alerts"
                  onClick={() => setOpen(false)}
                  className="block w-full text-left"
                  style={{
                    padding: 12,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    transition: "background-color var(--duration-normal) ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover-subtle)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-surface)"; }}
                >
                  <Stack gap={1}>
                    <Inline gap={2} align="center" wrap>
                      <Badge tone={SEVERITY_TONE[a.severity]} emphasis={a.severity === "CRITICAL" ? "strong" : "subtle"}>
                        {t(`alerts.severity.${a.severity}`)}
                      </Badge>
                      <Text size="sm" className="font-semibold">
                        {a.type === "VITALS_BREACH" ? t("alerts.type.VITALS_BREACH") : a.type}
                      </Text>
                    </Inline>
                    {a.residents && (
                      <Text size="sm" color="secondary">
                        {a.residents.name_zh ?? a.residents.name}
                      </Text>
                    )}
                    <Text size="caption" color="tertiary">{timeAgo(a.triggered_at, t)}</Text>
                  </Stack>
                </Link>
              ))}
            </Stack>
          )}
        </Stack>
      </Drawer>
    </>
  );
}
