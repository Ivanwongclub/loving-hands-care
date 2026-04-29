import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Phone, AlertTriangle } from "lucide-react";
import { FamilyShell } from "@/components/shells/FamilyShell";
import { FamilyProtectedRoute } from "@/lib/FamilyProtectedRoute";
import {
  Stack,
  Heading,
  Text,
  Card,
  Inline,
  Badge,
  Spinner,
  Avatar,
  Alert,
  ActivityItem,
  Timeline,
  EmptyState,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/components/alerts/timeUtils";
import { formatAuditAction } from "@/lib/auditFormat";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/family/dashboard")({
  component: FamilyDashboardPage,
});

interface BranchLite {
  name: string | null;
  name_zh: string | null;
  phone: string | null;
}

interface ResidentRow {
  id: string;
  name: string | null;
  name_zh: string | null;
  photo_storage_path: string | null;
  photo_declined: boolean;
  status: string;
  branch_id: string;
  do_not_share_family: boolean;
  branches: BranchLite | null;
}

interface AlertRow {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  triggered_at: string;
}

interface ActivityRow {
  id: string;
  action: string;
  created_at: string;
}

function FamilyDashboardPage() {
  return (
    <FamilyProtectedRoute>
      <FamilyDashboardContent />
    </FamilyProtectedRoute>
  );
}

function FamilyDashboardContent() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // 1. Resident (RLS scopes to family member's resident(s))
  const residentsQuery = useQuery({
    queryKey: ["family", "residents"],
    queryFn: async (): Promise<ResidentRow[]> => {
      const { data, error } = await supabase
        .from("residents")
        .select(
          "id, name, name_zh, photo_storage_path, photo_declined, status, branch_id, do_not_share_family, branches:branch_id(name, name_zh, phone)",
        )
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ResidentRow[];
    },
  });

  const resident: ResidentRow | undefined = residentsQuery.data?.[0];

  // 2. Photo signed URL
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!resident?.photo_storage_path || resident.photo_declined) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    void supabase.storage
      .from("resident-photos")
      .createSignedUrl(resident.photo_storage_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setPhotoUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [resident?.photo_storage_path, resident?.photo_declined]);

  // 3. Open alerts (RLS already limits to OPEN/ACK/ASSIGNED for family)
  const alertsQuery = useQuery({
    queryKey: ["family", "alerts", resident?.id ?? null],
    enabled: !!resident,
    queryFn: async (): Promise<AlertRow[]> => {
      if (!resident) return [];
      const { data, error } = await supabase
        .from("alerts")
        .select("id, type, severity, status, triggered_at")
        .eq("resident_id", resident.id)
        .order("triggered_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as AlertRow[];
    },
  });

  // 4. Activity feed (RLS limits to safe entity_type/action subset)
  const activityQuery = useQuery({
    queryKey: ["family", "activity", resident?.id ?? null],
    enabled: !!resident,
    queryFn: async (): Promise<ActivityRow[]> => {
      if (!resident) return [];
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, created_at")
        .eq("entity_id", resident.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  // 5. Track first / last login on resident_contacts
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const trackLogin = async () => {
      const { data: contact } = await supabase
        .from("resident_contacts")
        .select("id, portal_first_login_at")
        .eq("auth_user_id", user.id)
        .eq("is_portal_user", true)
        .maybeSingle();
      if (cancelled || !contact) return;
      const now = new Date().toISOString();
      const patch: Record<string, string> = { portal_last_login_at: now };
      if (!contact.portal_first_login_at) patch.portal_first_login_at = now;
      await supabase.from("resident_contacts").update(patch).eq("id", contact.id);
    };
    void trackLogin();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const branchPhone = resident?.branches?.phone ?? null;
  const branchName = resident?.branches?.name_zh ?? resident?.branches?.name ?? "";

  const statusBadge = useMemo(() => {
    if (!resident) return null;
    const s = resident.status;
    const tone =
      s === "ADMITTED"
        ? "success"
        : s === "LOA"
          ? "warning"
          : s === "DISCHARGED" || s === "DECEASED"
            ? "neutral"
            : "neutral";
    return (
      <Badge tone={tone} dot>
        {t(`residents.status.${s}`, { defaultValue: s })}
      </Badge>
    );
  }, [resident, t]);

  const alertSeverityTone = (sev: string): "neutral" | "info" | "warning" | "error" =>
    sev === "CRITICAL" ? "error" : sev === "HIGH" ? "error" : sev === "MEDIUM" ? "warning" : "info";

  const isLoading = residentsQuery.isLoading;
  const alerts = alertsQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  if (isLoading) {
    return (
      <FamilyShell>
        <div className="grid place-items-center" style={{ minHeight: 320 }}>
          <Spinner size="lg" />
        </div>
      </FamilyShell>
    );
  }

  // Defensive guard — RLS should already block this, but just in case
  if (!resident || resident.do_not_share_family) {
    return (
      <FamilyShell>
        <Stack gap={4}>
          <Heading level={1}>{t("familyPortal.welcome")}</Heading>
          <Alert severity="info" title={t("familyPortal.noResident")} />
        </Stack>
      </FamilyShell>
    );
  }

  return (
    <FamilyShell>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>{t("familyPortal.welcome")}</Heading>
          <Text color="secondary">{t("familyPortal.title")}</Text>
        </Stack>

        {/* Resident card */}
        <Card>
          <Inline gap={4} align="start">
            <Avatar name={resident.name_zh ?? resident.name ?? "?"} src={photoUrl ?? undefined} size="lg" />
            <Stack gap={2} className="flex-1 min-w-0">
              <Inline justify="between" align="center">
                <Stack gap={1}>
                  <Text className="font-semibold" size="lg">
                    {resident.name_zh ?? resident.name}
                  </Text>
                  {resident.name && resident.name_zh && (
                    <Text size="sm" color="secondary">{resident.name}</Text>
                  )}
                </Stack>
                {statusBadge}
              </Inline>
              {branchName && (
                <Text size="sm" color="secondary">{branchName}</Text>
              )}
              {branchPhone && (
                <a
                  href={`tel:${branchPhone}`}
                  className="inline-flex items-center gap-2 type-body-md font-semibold rounded-md px-3 py-2 self-start hover:opacity-90"
                  style={{
                    backgroundColor: "var(--color-iris-100)",
                    color: "var(--color-iris-500)",
                    minHeight: 44,
                  }}
                >
                  <Phone size={16} />
                  {t("familyPortal.callHome")} — {branchPhone}
                </a>
              )}
            </Stack>
          </Inline>
        </Card>

        {/* Open alerts */}
        {alerts.length > 0 && (
          <Card
            header={
              <Inline gap={2} align="center">
                <AlertTriangle size={18} style={{ color: "var(--status-warning-accent)" }} />
                <Text className="type-h3">
                  {t("familyPortal.alertsCount", { count: alerts.length })}
                </Text>
              </Inline>
            }
          >
            <Stack gap={3}>
              {alerts.map((a) => (
                <Inline key={a.id} justify="between" align="center">
                  <Inline gap={2} align="center">
                    <Badge tone={alertSeverityTone(a.severity)}>
                      {t(`alerts.severity.${a.severity}`, { defaultValue: a.severity })}
                    </Badge>
                    <Text size="sm">{t(`alerts.types.${a.type}`, { defaultValue: a.type })}</Text>
                  </Inline>
                  <Text size="sm" color="tertiary">{timeAgo(a.triggered_at, t)}</Text>
                </Inline>
              ))}
              <Text size="sm" color="secondary">{t("familyPortal.urgentNote")}</Text>
            </Stack>
          </Card>
        )}

        {/* Activity feed */}
        <Card header={<Text className="type-h3">{t("familyPortal.activity")}</Text>}>
          {activity.length === 0 ? (
            <EmptyState title={t("familyPortal.noActivity")} />
          ) : (
            <Timeline>
              {activity.map((a) => (
                <ActivityItem
                  key={a.id}
                  timestamp={timeAgo(a.created_at, t)}
                  action={formatAuditAction(a.action, t)}
                />
              ))}
            </Timeline>
          )}
        </Card>

        <Text size="sm" color="secondary" className="text-center">
          {t("familyPortal.questionNote")}
        </Text>
      </Stack>
    </FamilyShell>
  );
}
