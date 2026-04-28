import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, MessageSquare, Mail, RefreshCw } from "lucide-react";
import {
  Card, Stack, Inline, Text, Badge, Button, Switch, NumberField, TimeField,
  Tabs, Table, EmptyState, Modal, Skeleton, FormField, HelperText, type Column,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { Tables } from "@/integrations/supabase/types";

type Channel = "WHATSAPP" | "SMS" | "EMAIL";
type EventKey = "dcu_checkin" | "dcu_checkout" | "alert_critical" | "alert_high" | "incident_high";

interface NotifConfig {
  whatsapp_enabled?: boolean;
  sms_enabled?: boolean;
  email_enabled?: boolean;
  fallback_delay_seconds?: number;
  max_attempts?: number;
  retry_window_hours?: number;
  events?: Partial<Record<EventKey, Partial<Record<Channel, boolean>>>>;
  quiet_hours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    channels?: Channel[];
  };
}

function readConfig(branch: Tables<"branches"> | null): NotifConfig {
  return (branch?.notification_config as NotifConfig | null) ?? {};
}

const EVENT_KEYS: EventKey[] = ["dcu_checkin", "dcu_checkout", "alert_critical", "alert_high", "incident_high"];

export function NotificationsSection() {
  const { t } = useTranslation();
  const { branches, isLoading } = useBranches();
  const branch = branches[0] ?? null;
  const [tab, setTab] = useState("channels");

  if (isLoading) return <Card padding="lg"><Skeleton height={120} /></Card>;
  if (!branch) return <Card padding="lg"><Text size="sm" color="secondary">{t("common.loading")}</Text></Card>;

  return (
    <Stack gap={4}>
      <Text size="lg" className="font-semibold">{t("settings.notifications.title")}</Text>
      <Tabs
        style="line"
        value={tab}
        onChange={setTab}
        items={[
          { value: "channels", label: t("settings.notifications.tabs.channels") },
          { value: "events", label: t("settings.notifications.tabs.events") },
          { value: "quiet", label: t("settings.notifications.tabs.quietHours") },
          { value: "templates", label: t("settings.notifications.tabs.templates") },
          { value: "log", label: t("settings.notifications.tabs.deliveryLog") },
        ]}
      />
      {tab === "channels" && <ChannelsTab branch={branch} />}
      {tab === "events" && <EventsTab branch={branch} />}
      {tab === "quiet" && <QuietHoursTab branch={branch} />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "log" && <DeliveryLogTab branchId={branch.id} />}
    </Stack>
  );
}

/* ────────── helpers ────────── */
async function updateNotifConfig(branchId: string, prev: NotifConfig, patch: NotifConfig) {
  const merged = { ...prev, ...patch };
  const { error } = await supabase.from("branches").update({ notification_config: merged as never }).eq("id", branchId);
  if (error) throw error;
  return merged;
}

/* ────────── Channels Tab ────────── */
function ChannelsTab({ branch }: { branch: Tables<"branches"> }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const cfg = readConfig(branch);
  const [busy, setBusy] = useState(false);

  const handleToggle = async (key: keyof NotifConfig, val: boolean) => {
    setBusy(true);
    try {
      const before = cfg;
      const after = await updateNotifConfig(branch.id, before, { [key]: val } as NotifConfig);
      await logAction({
        action: "SETTINGS_UPDATE", entity_type: "branch_settings", entity_id: branch.id, branch_id: branch.id,
        before_state: { notification_config: before }, after_state: { notification_config: after },
      });
      toast.success(t("common.saved"));
      void qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const handleNumber = async (key: keyof NotifConfig, val: number) => {
    try {
      const before = cfg;
      const after = await updateNotifConfig(branch.id, before, { [key]: val } as NotifConfig);
      await logAction({
        action: "SETTINGS_UPDATE", entity_type: "branch_settings", entity_id: branch.id, branch_id: branch.id,
        before_state: { notification_config: before }, after_state: { notification_config: after },
      });
      void qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (err) { toast.error((err as Error).message); }
  };

  const showPlaceholderToast = () => toast.info(t("settings.notifications.phase2Coming"));

  const channels: { key: keyof NotifConfig; label: string; provider: string; icon: React.ReactNode }[] = [
    { key: "whatsapp_enabled", label: "WhatsApp", provider: "360dialog", icon: <MessageCircle size={20} /> },
    { key: "sms_enabled", label: "SMS", provider: "Twilio", icon: <MessageSquare size={20} /> },
    { key: "email_enabled", label: "Email", provider: "SendGrid", icon: <Mail size={20} /> },
  ];

  return (
    <Stack gap={3}>
      {channels.map((ch) => (
        <Card key={ch.key} padding="md">
          <Stack gap={3}>
            <Inline gap={3} align="center" justify="between">
              <Inline gap={2} align="center">
                <span style={{ color: "var(--text-secondary)" }}>{ch.icon}</span>
                <Text size="md" className="font-semibold">{ch.label}</Text>
                <Badge tone="warning">{t("settings.notifications.placeholder")}</Badge>
              </Inline>
              <Switch checked={!!cfg[ch.key]} onChange={(v) => handleToggle(ch.key, v)} disabled={busy} />
            </Inline>
            <Inline gap={4} align="center">
              <Text size="sm" color="secondary">Provider: {ch.provider}</Text>
              <Inline gap={1} align="center">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--status-warning-accent)" }} />
                <Text size="sm" color="secondary">Not configured</Text>
              </Inline>
            </Inline>
            <Inline gap={2}>
              <Button variant="soft" size="compact" onClick={showPlaceholderToast}>
                {t("settings.notifications.configureCredentials")}
              </Button>
              <Button variant="ghost" size="compact" disabled onClick={showPlaceholderToast}>
                {t("settings.notifications.testConnection")}
              </Button>
            </Inline>
            {ch.key === "whatsapp_enabled" && (
              <FormField label={`WhatsApp → SMS ${t("settings.notifications.fallbackDelay")} (s)`}>
                <NumberField
                  numericValue={cfg.fallback_delay_seconds ?? 60}
                  onValueChange={(v) => handleNumber("fallback_delay_seconds", v)}
                  unit="s" step={5} min={0}
                />
              </FormField>
            )}
          </Stack>
        </Card>
      ))}
      <Card padding="md">
        <Stack gap={3}>
          <Text size="md" className="font-semibold">Retry</Text>
          <FormField label={t("settings.notifications.maxAttempts")}>
            <NumberField numericValue={cfg.max_attempts ?? 3} onValueChange={(v) => handleNumber("max_attempts", Math.max(1, Math.min(10, v)))} step={1} min={1} />
          </FormField>
          <FormField label={`${t("settings.notifications.retryWindow")} (h)`}>
            <NumberField numericValue={cfg.retry_window_hours ?? 2} onValueChange={(v) => handleNumber("retry_window_hours", Math.max(1, Math.min(24, v)))} unit="h" step={1} min={1} />
          </FormField>
        </Stack>
      </Card>
    </Stack>
  );
}

/* ────────── Events Tab ────────── */
function EventsTab({ branch }: { branch: Tables<"branches"> }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const cfg = readConfig(branch);
  const events = cfg.events ?? {};

  const isOn = (ev: EventKey, ch: Channel) => !!events[ev]?.[ch];

  const handleToggle = async (ev: EventKey, ch: Channel, v: boolean) => {
    try {
      const before = cfg;
      const newEvents = { ...events, [ev]: { ...(events[ev] ?? {}), [ch]: v } };
      const after = await updateNotifConfig(branch.id, before, { events: newEvents });
      await logAction({
        action: "SETTINGS_UPDATE", entity_type: "branch_settings", entity_id: branch.id, branch_id: branch.id,
        before_state: { notification_config: before }, after_state: { notification_config: after },
      });
      void qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <Card padding="none">
      <table className="w-full type-body-md" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <th style={{ textAlign: "left", padding: 12, color: "var(--text-secondary)" }}>Event</th>
            <th style={{ padding: 12, color: "var(--text-secondary)" }}>WhatsApp</th>
            <th style={{ padding: 12, color: "var(--text-secondary)" }}>SMS</th>
            <th style={{ padding: 12, color: "var(--text-secondary)" }}>Email</th>
          </tr>
        </thead>
        <tbody>
          {EVENT_KEYS.map((ev) => (
            <tr key={ev} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td style={{ padding: 12 }}>{t(`settings.notifications.events.${ev}`)}</td>
              {(["WHATSAPP", "SMS", "EMAIL"] as Channel[]).map((ch) => (
                <td key={ch} style={{ padding: 12, textAlign: "center" }}>
                  <Switch checked={isOn(ev, ch)} onChange={(v) => handleToggle(ev, ch, v)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ────────── Quiet Hours Tab ────────── */
function QuietHoursTab({ branch }: { branch: Tables<"branches"> }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cfg = readConfig(branch);
  const qh = cfg.quiet_hours ?? {};
  const [enabled, setEnabled] = useState(!!qh.enabled);
  const [start, setStart] = useState(qh.start ?? "23:00");
  const [end, setEnd] = useState(qh.end ?? "07:00");
  const [chans, setChans] = useState<Channel[]>(qh.channels ?? ["SMS"]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = readConfig(branch).quiet_hours ?? {};
    setEnabled(!!q.enabled); setStart(q.start ?? "23:00"); setEnd(q.end ?? "07:00"); setChans(q.channels ?? ["SMS"]);
  }, [branch.id, branch.notification_config]);

  const save = async () => {
    setBusy(true);
    try {
      await updateNotifConfig(branch.id, cfg, { quiet_hours: { enabled, start, end, channels: chans } });
      toast.success(t("common.saved"));
      void qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const toggleChan = (ch: Channel) => {
    setChans((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

  return (
    <Card padding="md">
      <Stack gap={3}>
        <Switch checked={enabled} onChange={setEnabled} label={t("settings.notifications.quietHoursEnabled")} />
        <Inline gap={3} align="center">
          <FormField label={t("settings.notifications.quietHoursRange")}>
            <Inline gap={2} align="center">
              <TimeField value={start} onChange={(e) => setStart(e.target.value)} />
              <Text size="sm" color="secondary">→</Text>
              <TimeField value={end} onChange={(e) => setEnd(e.target.value)} />
            </Inline>
          </FormField>
        </Inline>
        <Inline gap={3} align="center">
          {(["SMS", "WHATSAPP", "EMAIL"] as Channel[]).map((ch) => (
            <label key={ch} className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={chans.includes(ch)} onChange={() => toggleChan(ch)} style={{ accentColor: "var(--action-primary)" }} />
              <Text size="sm">{ch}</Text>
            </label>
          ))}
        </Inline>
        <div><Button variant="primary" onClick={save} disabled={busy}>{t("actions.save")}</Button></div>
      </Stack>
    </Card>
  );
}

/* ────────── Templates Tab ────────── */
interface TemplateRow extends Tables<"notification_templates"> { /* */ }

function TemplatesTab() {
  const { t } = useTranslation();
  const [view, setView] = useState<TemplateRow | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["notif-templates", "system-defaults"],
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await supabase
        .from("notification_templates").select("*").is("branch_id", null).order("event_type").order("language");
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const cols: Column<TemplateRow>[] = [
    { key: "event_type", header: "Event", cell: (r) => <span>{r.event_type}</span> },
    { key: "channel", header: "Channel", cell: (r) => <span>{r.channel}</span>, width: 100 },
    { key: "language", header: "Lang", cell: (r) => <span>{r.language}</span>, width: 80 },
    { key: "preview", header: "Preview", cell: (r) => <span className="line-clamp-1" style={{ color: "var(--text-secondary)" }}>{r.body.slice(0, 60)}…</span> },
    { key: "actions", header: "", width: 80, cell: (r) => <Button variant="ghost" size="compact" onClick={() => setView(r)}>{t("actions.view")}</Button> },
  ];

  return (
    <Stack gap={3}>
      {isLoading ? <Skeleton height={120} /> : (
        <Table<TemplateRow>
          columns={cols}
          rows={data ?? []}
          rowKey={(r) => r.id}
          empty={<EmptyState title={t("settings.comingSoon")} />}
        />
      )}
      <Card padding="md">
        <EmptyState title={t("settings.comingSoon")} description="自訂分院範本 — 即將推出" />
      </Card>
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.event_type} · ${view.channel} · ${view.language}` : ""}>
        {view && (
          <Stack gap={3}>
            <Inline gap={1}>
              {view.variables.map((v) => <Badge key={v} tone="info">{v}</Badge>)}
            </Inline>
            <pre className="whitespace-pre-wrap type-body-md" style={{ color: "var(--text-primary)", backgroundColor: "var(--bg-subtle)", padding: 12, borderRadius: "var(--radius-md)" }}>
              {view.body}
            </pre>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

/* ────────── Delivery Log Tab ────────── */
function DeliveryLogTab({ branchId }: { branchId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notif-log", branchId],
    queryFn: async (): Promise<Tables<"notification_log">[]> => {
      const { data, error } = await supabase
        .from("notification_log").select("*").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Tables<"notification_log">[];
    },
  });

  const summary = useMemo(() => {
    const rows = data ?? [];
    const now = Date.now(); const cutoff = now - 30 * 24 * 3600 * 1000;
    const last30 = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
    const delivered = last30.filter((r) => r.status === "DELIVERED" || r.status === "SENT").length;
    const failed = last30.filter((r) => r.status === "FAILED").length;
    const total = delivered + failed;
    const rate = total === 0 ? 0 : Math.round((delivered / total) * 100);
    return { delivered, failed, rate };
  }, [data]);

  const resend = async (row: Tables<"notification_log">) => {
    try {
      const { error } = await supabase.from("notification_queue").insert({
        branch_id: row.branch_id, event_type: row.event_type, channel: row.channel,
        recipient_phone: row.recipient_masked, message: row.message_preview ?? "",
        resident_id: row.resident_id, status: "PENDING", attempt_count: 0,
      });
      if (error) throw error;
      toast.success(t("settings.notifications.resend"));
      void qc.invalidateQueries({ queryKey: ["notif-log", branchId] });
    } catch (err) { toast.error((err as Error).message); }
  };

  const cols: Column<Tables<"notification_log">>[] = [
    { key: "time", header: "Time", cell: (r) => <span>{new Date(r.created_at).toLocaleString()}</span>, width: 170 },
    { key: "event", header: "Event", cell: (r) => <span>{r.event_type}</span> },
    { key: "ch", header: "Ch", cell: (r) => <span>{r.channel}</span>, width: 90 },
    { key: "to", header: "To", cell: (r) => <span>{r.recipient_masked}</span>, width: 140 },
    { key: "status", header: "Status", width: 100, cell: (r) => (
      <Badge tone={r.status === "FAILED" ? "error" : r.status === "DELIVERED" || r.status === "SENT" ? "success" : "neutral"}>{r.status}</Badge>
    ) },
    { key: "reason", header: "Reason", cell: (r) => <span style={{ color: "var(--text-tertiary)" }}>{r.failure_reason ?? "—"}</span> },
    { key: "actions", header: "", width: 100, cell: (r) => r.status === "FAILED" ? (
      <Button variant="ghost" size="compact" onClick={() => resend(r)}>{t("settings.notifications.resend")}</Button>
    ) : null },
  ];

  return (
    <Stack gap={3}>
      <Card padding="md">
        <Text size="sm" color="secondary">
          {t("settings.notifications.deliverySummary")}: ✅ {summary.delivered} / ❌ {summary.failed} ({summary.rate}%)
        </Text>
      </Card>
      {isLoading ? <Skeleton height={200} /> : (
        <Table<Tables<"notification_log">>
          columns={cols}
          rows={data ?? []}
          rowKey={(r) => r.id}
          empty={<EmptyState title={t("activity.empty")} />}
        />
      )}
    </Stack>
  );
}
