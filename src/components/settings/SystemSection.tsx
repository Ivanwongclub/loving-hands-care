import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Pencil, Play, Lock } from "lucide-react";
import {
  Card, Stack, Inline, Text, Badge, Button, Switch, NumberField, FormField,
  Skeleton, ConfirmDialog, Modal, Select, TextField, EmptyState,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { Tables } from "@/integrations/supabase/types";

interface SLAConfig {
  icp_approval_roles?: string[];
  task_overdue?: Partial<Record<TaskKey, number>>;
  [k: string]: unknown;
}
type TaskKey = "VITALS" | "MEDICATION_PREP" | "WOUND_CARE" | "ADL" | "ASSESSMENT" | "OTHER";
const TASK_KEYS: TaskKey[] = ["VITALS", "MEDICATION_PREP", "WOUND_CARE", "ADL", "ASSESSMENT", "OTHER"];
const TASK_DEFAULTS: Record<TaskKey, number> = { VITALS: 30, MEDICATION_PREP: 15, WOUND_CARE: 60, ADL: 120, ASSESSMENT: 240, OTHER: 60 };
const APPROVAL_ROLES = ["BRANCH_ADMIN", "SENIOR_NURSE", "SYSTEM_ADMIN"];

export function SystemSection() {
  const { t } = useTranslation();
  const { staff } = useCurrentStaff();
  const isSysAdmin = staff?.role === "SYSTEM_ADMIN";
  return (
    <Stack gap={4}>
      <Text size="lg" className="font-semibold">{t("settings.system.title")}</Text>
      <IcpTaskConfigSection />
      <WorkflowEngineSection isSysAdmin={isSysAdmin} />
      {isSysAdmin && <SystemHealthSection />}
      {isSysAdmin && <BackupConfigSection />}
      {isSysAdmin && <RetentionPolicySection />}
    </Stack>
  );
}

/* ────────── ICP & Tasks ────────── */
function IcpTaskConfigSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { branches, isLoading } = useBranches();
  const branch = branches[0] ?? null;
  const [roles, setRoles] = useState<string[]>([]);
  const [overdue, setOverdue] = useState<Record<TaskKey, number>>(TASK_DEFAULTS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cfg = (branch?.sla_config as SLAConfig | null) ?? {};
    setRoles(cfg.icp_approval_roles ?? ["BRANCH_ADMIN", "SENIOR_NURSE"]);
    const next = { ...TASK_DEFAULTS, ...(cfg.task_overdue ?? {}) } as Record<TaskKey, number>;
    setOverdue(next);
  }, [branch?.id, branch?.sla_config]);

  if (isLoading) return <Card padding="lg"><Skeleton height={120} /></Card>;
  if (!branch) return null;

  const toggleRole = (r: string) => setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const save = async () => {
    setBusy(true);
    try {
      const beforeCfg = (branch.sla_config as SLAConfig | null) ?? {};
      const newCfg = { ...beforeCfg, icp_approval_roles: roles, task_overdue: overdue };
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
        <Text size="md" className="font-semibold">{t("settings.system.icpTasks")}</Text>
        <FormField label={t("settings.system.icpApprovalRoles")}>
          <Inline gap={3}>
            {APPROVAL_ROLES.map((r) => (
              <label key={r} className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} style={{ accentColor: "var(--action-primary)" }} />
                <Text size="sm">{r}</Text>
              </label>
            ))}
          </Inline>
        </FormField>
        <Text size="sm" color="secondary">{t("settings.system.taskOverdue")}</Text>
        {TASK_KEYS.map((k) => (
          <FormField key={k} label={t(`settings.system.taskTypes.${k}`)}>
            <NumberField numericValue={overdue[k]} onValueChange={(v) => setOverdue((p) => ({ ...p, [k]: v }))} unit="min" step={5} min={1} />
          </FormField>
        ))}
        <div><Button variant="primary" onClick={save} disabled={busy}>{t("actions.save")}</Button></div>
      </Stack>
    </Card>
  );
}

/* ────────── Workflow Engine ────────── */
type Job = Tables<"system_jobs">;
type Run = Tables<"system_job_runs">;

function WorkflowEngineSection({ isSysAdmin }: { isSysAdmin: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirmDisable, setConfirmDisable] = useState<Job | null>(null);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const jobsQ = useQuery({
    queryKey: ["system_jobs"],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase.from("system_jobs").select("*").order("job_name");
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });

  const jobNames = useMemo(() => (jobsQ.data ?? []).map((j) => j.job_name), [jobsQ.data]);
  const runsQ = useQuery({
    queryKey: ["system_job_runs", jobNames.join(",")],
    enabled: jobNames.length > 0,
    queryFn: async (): Promise<Run[]> => {
      const { data, error } = await supabase
        .from("system_job_runs").select("*").in("job_name", jobNames).order("started_at", { ascending: false }).limit(jobNames.length * 5);
      if (error) throw error;
      return (data ?? []) as Run[];
    },
  });

  const runsByJob = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const r of runsQ.data ?? []) {
      const arr = map.get(r.job_name) ?? [];
      if (arr.length < 5) arr.push(r);
      map.set(r.job_name, arr);
    }
    return map;
  }, [runsQ.data]);

  const toggleEnable = async (job: Job, val: boolean) => {
    try {
      const { error } = await supabase.from("system_jobs").update({ is_enabled: val }).eq("id", job.id);
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ["system_jobs"] });
      toast.success(t("common.saved"));
    } catch (err) { toast.error((err as Error).message); }
  };

  const runNow = async (job: Job) => {
    setRunningJob(job.job_name);
    try {
      const { error } = await supabase.functions.invoke(job.job_name, { body: {} });
      if (error) throw error;
      toast.success(t("settings.system.jobRunning"));
      void qc.invalidateQueries({ queryKey: ["system_jobs"] });
      void qc.invalidateQueries({ queryKey: ["system_job_runs"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setRunningJob(null); }
  };

  const statusBadge = (j: Job) => {
    if (!j.is_enabled) return <Badge tone="neutral">停用</Badge>;
    if (j.last_run_status === "FAILED") return <Badge tone="error">失敗</Badge>;
    if (j.last_run_status === "SUCCESS") return <Badge tone="success">活躍</Badge>;
    return <Badge tone="warning">待執行</Badge>;
  };

  const fmt = (s: string | null) => s ? new Date(s).toLocaleString() : "—";

  return (
    <Card padding="none">
      <div style={{ padding: 16, borderBottom: "1px solid var(--border-subtle)" }}>
        <Text size="md" className="font-semibold">{t("settings.system.workflowEngine")}</Text>
      </div>
      {jobsQ.isLoading ? (
        <div style={{ padding: 16 }}><Skeleton height={120} /></div>
      ) : (jobsQ.data ?? []).length === 0 ? (
        <EmptyState title={t("activity.empty")} />
      ) : (
        <table className="w-full type-body-md" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={{ textAlign: "left", padding: 12, color: "var(--text-secondary)" }}>Job</th>
              <th style={{ textAlign: "left", padding: 12, color: "var(--text-secondary)" }}>Schedule</th>
              <th style={{ textAlign: "left", padding: 12, color: "var(--text-secondary)" }}>Last run</th>
              <th style={{ padding: 12, color: "var(--text-secondary)" }}>Status</th>
              <th style={{ padding: 12 }}></th>
            </tr>
          </thead>
          <tbody>
            {(jobsQ.data ?? []).map((j) => {
              const runs = runsByJob.get(j.job_name) ?? [];
              const open = expanded === j.job_name;
              return (
                <>
                  <tr key={j.id} style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }} onClick={() => setExpanded(open ? null : j.job_name)}>
                    <td style={{ padding: 12 }}>
                      <Stack gap={1}>
                        <span className="font-medium">{j.display_name_zh}</span>
                        <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>{j.job_name}</span>
                      </Stack>
                    </td>
                    <td style={{ padding: 12 }}>
                      <Inline gap={1} align="center">
                        <span>{j.schedule_hkt_label_zh}</span>
                        {isSysAdmin && j.is_schedule_editable && (
                          <button onClick={(e) => { e.stopPropagation(); setEditJob(j); }} className="p-1 rounded hover:bg-[var(--bg-hover-subtle)]" aria-label="edit">
                            <Pencil size={12} />
                          </button>
                        )}
                      </Inline>
                    </td>
                    <td style={{ padding: 12, color: "var(--text-secondary)" }}>
                      {fmt(j.last_run_at)}{j.last_run_ms ? ` (${j.last_run_ms}ms)` : ""}
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>{statusBadge(j)}</td>
                    <td style={{ padding: 12 }} onClick={(e) => e.stopPropagation()}>
                      <Inline gap={1}>
                        <Switch checked={j.is_enabled} onChange={(v) => v ? toggleEnable(j, true) : setConfirmDisable(j)} />
                        <Button variant="ghost" size="compact" onClick={() => runNow(j)} disabled={runningJob === j.job_name} leadingIcon={<Play size={12} />}>
                          {t("settings.system.runNow")}
                        </Button>
                      </Inline>
                    </td>
                  </tr>
                  {open && (
                    <tr key={`${j.id}-runs`}>
                      <td colSpan={5} style={{ padding: 12, backgroundColor: "var(--bg-subtle)" }}>
                        {runs.length === 0 ? (
                          <Text size="sm" color="secondary">{t("activity.empty")}</Text>
                        ) : (
                          <Stack gap={1}>
                            {runs.map((r) => (
                              <Inline key={r.id} gap={2}>
                                <span>{r.status === "SUCCESS" ? "✅" : r.status === "FAILED" ? "❌" : "⏳"}</span>
                                <span>{fmt(r.started_at)}</span>
                                <span style={{ color: "var(--text-tertiary)" }}>{r.duration_ms ? `${r.duration_ms}ms` : "—"}</span>
                                <span style={{ color: "var(--text-secondary)" }}>{r.message ?? ""}</span>
                              </Inline>
                            ))}
                          </Stack>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
      {confirmDisable && (
        <ConfirmDialog
          open
          onClose={() => setConfirmDisable(null)}
          onConfirm={async () => { await toggleEnable(confirmDisable, false); setConfirmDisable(null); }}
          title={t("settings.system.disableJob")}
          summary={t("settings.system.disableConfirm")}
          confirmLabel={t("settings.system.disableJob")}
          cancelLabel={t("actions.cancel")}
        />
      )}
      {editJob && <ScheduleEditModal job={editJob} onClose={() => setEditJob(null)} />}
    </Card>
  );
}

function ScheduleEditModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const PRESETS: { value: string; label: string; cron: string }[] = [
    { value: "every5", label: t("settings.system.schedulePresets.every5"), cron: "*/5 * * * *" },
    { value: "every15", label: t("settings.system.schedulePresets.every15"), cron: "*/15 * * * *" },
    { value: "every30", label: t("settings.system.schedulePresets.every30"), cron: "*/30 * * * *" },
    { value: "hourly", label: t("settings.system.schedulePresets.hourly"), cron: "0 * * * *" },
    { value: "daily", label: t("settings.system.schedulePresets.daily"), cron: "0 18 * * *" },
    { value: "custom", label: t("settings.system.schedulePresets.custom"), cron: job.schedule_utc },
  ];
  const [preset, setPreset] = useState("custom");
  const [cron, setCron] = useState(job.schedule_utc);
  const [busy, setBusy] = useState(false);

  const onPreset = (v: string) => {
    setPreset(v);
    const found = PRESETS.find((p) => p.value === v);
    if (found && v !== "custom") setCron(found.cron);
  };

  const tooShort = job.min_interval_minutes && (preset === "every5" && job.min_interval_minutes > 5);

  const save = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("update-job-schedule", {
        body: {
          job_name: job.job_name,
          new_schedule_utc: cron,
          new_schedule_hkt_label: PRESETS.find((p) => p.value === preset)?.label ?? cron,
          new_schedule_hkt_label_zh: PRESETS.find((p) => p.value === preset)?.label ?? cron,
        },
      });
      if (error) throw error;
      toast.success(t("common.saved"));
      void qc.invalidateQueries({ queryKey: ["system_jobs"] });
      onClose();
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={t("settings.system.editSchedule")} footer={
      <>
        <Button variant="soft" onClick={onClose}>{t("actions.cancel")}</Button>
        <Button variant="primary" onClick={save} disabled={busy}>{t("actions.save")}</Button>
      </>
    }>
      <Stack gap={3}>
        <FormField label="Preset">
          <Select value={preset} onChange={(e) => onPreset((e.target as HTMLSelectElement).value)} options={PRESETS.map((p) => ({ value: p.value, label: p.label }))} />
        </FormField>
        <FormField label="Cron (UTC)">
          <TextField value={cron} onChange={(e) => setCron(e.target.value)} disabled={preset !== "custom"} />
        </FormField>
        <Text size="sm" color="secondary">UTC: {cron}</Text>
        {tooShort && <Text size="sm" style={{ color: "var(--status-warning-text)" }}>min_interval_minutes = {job.min_interval_minutes}</Text>}
      </Stack>
    </Modal>
  );
}

/* ────────── System Health ────────── */
interface HealthResponse {
  status?: "healthy" | "degraded";
  edge_functions?: { name: string; last_run_at?: string | null; last_run_status?: string | null; last_run_message?: string | null }[];
  jobs?: { active: number; disabled: number; failed_24h: number };
  notifications?: { delivery_rate_7d: number };
}

function SystemHealthSection() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [backup, setBackup] = useState<Tables<"backup_log"> | null>(null);

  const load = async () => {
    setBusy(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke<HealthResponse>("get-system-health");
      if (error) throw error;
      setData(resp ?? null);
      const { data: b } = await supabase.from("backup_log").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
      setBackup((b as Tables<"backup_log"> | null) ?? null);
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  useEffect(() => { void load(); }, []);

  const overall = data?.status ?? (data?.edge_functions?.some((f) => f.last_run_status === "FAILED") ? "degraded" : "healthy");
  const rate = data?.notifications?.delivery_rate_7d ?? 0;

  return (
    <Card padding="md">
      <Stack gap={3}>
        <Inline gap={2} align="center" justify="between">
          <Text size="md" className="font-semibold">{t("settings.system.health.title")}</Text>
          <Button variant="ghost" size="compact" leadingIcon={<RefreshCw size={14} />} onClick={load} disabled={busy}>
            {t("settings.system.health.refresh")}
          </Button>
        </Inline>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card padding="md">
            <Stack gap={1}>
              <Text size="sm" color="secondary">{t("settings.system.health.title")}</Text>
              <Badge tone={overall === "healthy" ? "success" : "warning"}>
                {overall === "healthy" ? t("settings.system.health.healthy") : t("settings.system.health.degraded")}
              </Badge>
            </Stack>
          </Card>
          <Card padding="md">
            <Stack gap={1}>
              <Text size="sm" color="secondary">{t("settings.system.health.scheduledJobs")}</Text>
              <Text size="md">{data?.jobs?.active ?? 0} active / {data?.jobs?.disabled ?? 0} disabled / {data?.jobs?.failed_24h ?? 0} failed</Text>
            </Stack>
          </Card>
          <Card padding="md">
            <Stack gap={1}>
              <Text size="sm" color="secondary">{t("settings.system.health.notificationHealth")}</Text>
              <Text size="md">{t("settings.system.health.deliveryRate")}: {rate}%</Text>
              <div style={{ height: 6, backgroundColor: "var(--bg-subtle)", borderRadius: 3 }}>
                <div style={{ width: `${rate}%`, height: "100%", backgroundColor: rate < 80 ? "var(--status-warning-accent)" : "var(--status-success-accent)", borderRadius: 3 }} />
              </div>
            </Stack>
          </Card>
          <Card padding="md">
            <Stack gap={1}>
              <Text size="sm" color="secondary">{t("settings.system.health.backupStatus")}</Text>
              <Text size="md">
                {backup ? `${new Date(backup.started_at).toLocaleString()} · ${backup.status}` : t("settings.system.health.noBackup")}
              </Text>
            </Stack>
          </Card>
        </div>
        <Card padding="md">
          <Stack gap={2}>
            <Text size="sm" color="secondary">{t("settings.system.health.edgeFunctions")}</Text>
            {(data?.edge_functions ?? []).map((f) => (
              <Inline key={f.name} gap={2} align="center">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.last_run_status === "FAILED" ? "var(--status-error-accent)" : f.last_run_status === "SUCCESS" ? "var(--status-success-accent)" : "var(--color-neutral-400)" }} />
                <Text size="sm">{f.name}</Text>
                <Text size="sm" color="secondary">{f.last_run_at ? new Date(f.last_run_at).toLocaleString() : "—"}</Text>
                {f.last_run_status === "FAILED" && f.last_run_message && (
                  <Text size="sm" style={{ color: "var(--status-error-text)" }}>{f.last_run_message.slice(0, 60)}</Text>
                )}
              </Inline>
            ))}
          </Stack>
        </Card>
      </Stack>
    </Card>
  );
}

/* ────────── Backup Config ────────── */
interface BackupCfg {
  provider?: string;
  bucket?: string;
  region?: string;
  retention_months?: number;
  rpo_hours?: number;
  rto_hours?: number;
  alert_email?: string;
  [k: string]: unknown;
}
interface SystemCfg {
  backup?: BackupCfg;
  storage_warn_pct?: number;
  system_log_retention_days?: number;
  [k: string]: unknown;
}

function BackupConfigSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { branches, isLoading } = useBranches();
  const branch = branches[0] ?? null;

  const [provider, setProvider] = useState("B2");
  const [bucket, setBucket] = useState("");
  const [region, setRegion] = useState("");
  const [retentionMonths, setRetentionMonths] = useState(84);
  const [rpoHours, setRpoHours] = useState(24);
  const [rtoHours, setRtoHours] = useState(4);
  const [alertEmail, setAlertEmail] = useState("");
  const [storageWarnPct, setStorageWarnPct] = useState(75);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);

  const backupQ = useQuery({
    queryKey: ["backup_log", "latest"],
    staleTime: 30_000,
    queryFn: async (): Promise<Tables<"backup_log"> | null> => {
      const { data } = await supabase.from("backup_log").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
      return (data as Tables<"backup_log"> | null) ?? null;
    },
  });

  useEffect(() => {
    const sys = (branch?.system_config as SystemCfg | null) ?? {};
    const b = sys.backup ?? {};
    setProvider(b.provider ?? "B2");
    setBucket(b.bucket ?? "");
    setRegion(b.region ?? "");
    setRetentionMonths(b.retention_months ?? 84);
    setRpoHours(b.rpo_hours ?? 24);
    setRtoHours(b.rto_hours ?? 4);
    setAlertEmail(b.alert_email ?? "");
    setStorageWarnPct(typeof sys.storage_warn_pct === "number" ? sys.storage_warn_pct : 75);
  }, [branch?.id, branch?.system_config]);

  if (isLoading) return <Card padding="lg"><Skeleton height={200} /></Card>;
  if (!branch) return null;

  const emailValid = !alertEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail);
  const retentionTooLow = retentionMonths < 84;
  const bucketMissing = !!provider && !bucket.trim();

  const save = async () => {
    if (retentionTooLow || !emailValid || bucketMissing) {
      toast.error("Invalid input");
      return;
    }
    setBusy(true);
    try {
      const beforeSys = (branch.system_config as SystemCfg | null) ?? {};
      const newSys: SystemCfg = {
        ...beforeSys,
        backup: {
          ...(beforeSys.backup ?? {}),
          provider,
          bucket,
          region,
          retention_months: Math.max(84, retentionMonths),
          rpo_hours: rpoHours,
          rto_hours: rtoHours,
          alert_email: alertEmail,
        },
        storage_warn_pct: storageWarnPct,
      };
      const { error } = await supabase.from("branches").update({ system_config: newSys as never }).eq("id", branch.id);
      if (error) throw error;
      await logAction({
        action: "SETTINGS_UPDATE", entity_type: "branch_settings", entity_id: branch.id, branch_id: branch.id,
        before_state: { system_config: beforeSys }, after_state: { system_config: newSys },
      });
      toast.success(t("common.saved"));
      void qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("run-offsite-backup", { body: { type: "manual", triggered_by: "MANUAL" } });
      if (error) throw error;
      toast.success(t("settings.system.backup.runStarted"));
      void qc.invalidateQueries({ queryKey: ["backup_log"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setRunning(false); }
  };

  const phase2 = () => toast.info(t("settings.system.backup.phase2Coming"));
  const latest = backupQ.data;

  return (
    <Card padding="md">
      <Stack gap={3}>
        <Text size="md" className="font-semibold">{t("settings.system.backup.title")}</Text>
        <Card padding="md">
          <Stack gap={1}>
            <Text size="sm" color="secondary">{t("settings.system.health.backupStatus")}</Text>
            <Text size="md">
              {latest ? `${new Date(latest.started_at).toLocaleString()} · ${latest.status}` : t("settings.system.health.noBackup")}
            </Text>
          </Stack>
        </Card>

        <FormField label={t("settings.system.backup.provider")}>
          <Select
            value={provider}
            onChange={(e) => setProvider((e.target as HTMLSelectElement).value)}
            options={[
              { value: "B2", label: t("settings.system.backup.providers.B2") },
              { value: "S3", label: t("settings.system.backup.providers.S3") },
              { value: "GCS", label: t("settings.system.backup.providers.GCS") },
            ]}
          />
        </FormField>
        <FormField label={t("settings.system.backup.bucket")} error={bucketMissing ? "Required" : undefined}>
          <TextField value={bucket} onChange={(e) => setBucket(e.target.value)} />
        </FormField>
        <FormField label={t("settings.system.backup.regionEndpoint")}>
          <TextField value={region} onChange={(e) => setRegion(e.target.value)} />
        </FormField>

        <FormField label={t("settings.system.backup.credentials")}>
          <Inline gap={2} align="center">
            <Badge tone="neutral">{t("settings.system.backup.notConfigured")}</Badge>
            <Button variant="ghost" size="compact" onClick={phase2}>{t("settings.system.backup.configure")} →</Button>
          </Inline>
        </FormField>
        <FormField label={t("settings.system.backup.encryptionKey")}>
          <Inline gap={2} align="center">
            <Badge tone="neutral">{t("settings.system.backup.notConfigured")}</Badge>
            <Button variant="ghost" size="compact" onClick={phase2}>{t("settings.system.backup.configure")} →</Button>
          </Inline>
        </FormField>

        <FormField
          label={t("settings.system.backup.retentionMonths")}
          hint={t("settings.system.backup.retentionMin")}
          error={retentionTooLow ? t("settings.system.backup.retentionMin") : undefined}
        >
          <NumberField numericValue={retentionMonths} onValueChange={setRetentionMonths} min={84} step={1} unit="mo" />
        </FormField>
        <FormField label={t("settings.system.backup.rpoHours")}>
          <NumberField numericValue={rpoHours} onValueChange={setRpoHours} min={1} step={1} unit="h" />
        </FormField>
        <FormField label={t("settings.system.backup.rtoHours")}>
          <NumberField numericValue={rtoHours} onValueChange={setRtoHours} min={1} step={1} unit="h" />
        </FormField>
        <FormField label={t("settings.system.backup.alertEmail")} error={!emailValid ? "Invalid email" : undefined}>
          <TextField type="email" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
        </FormField>
        <FormField label={t("settings.system.backup.storageWarnPct")}>
          <NumberField numericValue={storageWarnPct} onValueChange={setStorageWarnPct} min={1} max={100} step={1} unit="%" />
        </FormField>

        <Inline gap={2}>
          <Button variant="primary" onClick={save} disabled={busy}>{t("actions.save")}</Button>
          <Button variant="soft" onClick={runNow} disabled={running} leadingIcon={<Play size={14} />}>
            {t("settings.system.backup.runNow")}
          </Button>
        </Inline>
      </Stack>
    </Card>
  );
}

/* ────────── Retention Policy ────────── */
interface NotifCfg {
  log_retention_days?: number;
  [k: string]: unknown;
}

function RetentionPolicySection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { branches, isLoading } = useBranches();
  const branch = branches[0] ?? null;

  const [notifDays, setNotifDays] = useState(90);
  const [sysLogDays, setSysLogDays] = useState(30);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const notif = (branch?.notification_config as NotifCfg | null) ?? {};
    const sys = (branch?.system_config as SystemCfg | null) ?? {};
    setNotifDays(typeof notif.log_retention_days === "number" ? notif.log_retention_days : 90);
    setSysLogDays(typeof sys.system_log_retention_days === "number" ? sys.system_log_retention_days : 30);
  }, [branch?.id, branch?.notification_config, branch?.system_config]);

  if (isLoading) return <Card padding="lg"><Skeleton height={160} /></Card>;
  if (!branch) return null;

  const notifValid = notifDays >= 30 && notifDays <= 365;
  const sysValid = sysLogDays >= 7 && sysLogDays <= 90;

  const save = async () => {
    if (!notifValid || !sysValid) {
      toast.error("Invalid input");
      return;
    }
    setBusy(true);
    try {
      const beforeNotif = (branch.notification_config as NotifCfg | null) ?? {};
      const beforeSys = (branch.system_config as SystemCfg | null) ?? {};
      const newNotif: NotifCfg = { ...beforeNotif, log_retention_days: notifDays };
      const newSys: SystemCfg = { ...beforeSys, system_log_retention_days: sysLogDays };
      const { error } = await supabase.from("branches").update({
        notification_config: newNotif as never,
        system_config: newSys as never,
      }).eq("id", branch.id);
      if (error) throw error;
      await logAction({
        action: "SETTINGS_UPDATE", entity_type: "branch_settings", entity_id: branch.id, branch_id: branch.id,
        before_state: { notification_config: beforeNotif, system_config: beforeSys },
        after_state: { notification_config: newNotif, system_config: newSys },
      });
      toast.success(t("common.saved"));
      void qc.invalidateQueries({ queryKey: ["branches"] });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const lockedRows: { key: string; label: string }[] = [
    { key: "clinicalRecords", label: t("settings.system.retention.clinicalRecords") },
    { key: "emar", label: t("settings.system.retention.emar") },
    { key: "incidents", label: t("settings.system.retention.incidents") },
    { key: "auditLogs", label: t("settings.system.retention.auditLogs") },
  ];

  return (
    <Card padding="md">
      <Stack gap={3}>
        <Text size="md" className="font-semibold">{t("settings.system.retention.title")}</Text>
        <Text size="sm" color="secondary">{t("settings.system.retention.legalNote")}</Text>
        <table className="w-full type-body-md" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={{ textAlign: "left", padding: 12, color: "var(--text-secondary)" }}>{t("settings.system.retention.category")}</th>
              <th style={{ textAlign: "left", padding: 12, color: "var(--text-secondary)" }}>{t("settings.system.retention.period")}</th>
            </tr>
          </thead>
          <tbody>
            {lockedRows.map((r) => (
              <tr key={r.key} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: 12 }}>{r.label}</td>
                <td style={{ padding: 12 }}>
                  <Inline gap={2} align="center">
                    <Lock size={12} style={{ color: "var(--text-tertiary)" }} />
                    <Text size="sm">{t("settings.system.retention.sevenYears")}</Text>
                    <Badge tone="neutral">{t("settings.system.retention.legalMinimum")}</Badge>
                  </Inline>
                </td>
              </tr>
            ))}
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td style={{ padding: 12 }}>{t("settings.system.retention.notificationLogs")}</td>
              <td style={{ padding: 12 }}>
                <Inline gap={2} align="center">
                  <NumberField numericValue={notifDays} onValueChange={setNotifDays} min={30} max={365} step={1} unit={t("settings.system.retention.days")} />
                </Inline>
              </td>
            </tr>
            <tr>
              <td style={{ padding: 12 }}>{t("settings.system.retention.systemLogs")}</td>
              <td style={{ padding: 12 }}>
                <Inline gap={2} align="center">
                  <NumberField numericValue={sysLogDays} onValueChange={setSysLogDays} min={7} max={90} step={1} unit={t("settings.system.retention.days")} />
                </Inline>
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <Button variant="primary" onClick={save} disabled={busy}>{t("settings.system.retention.saveConfigurable")}</Button>
        </div>
      </Stack>
    </Card>
  );
}
