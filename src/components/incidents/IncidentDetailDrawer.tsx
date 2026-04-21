import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Drawer, Stack, Inline, Text, Badge, Button, Surface, FormField, TextField,
  Tabs, Alert, Divider, Spinner,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums, TablesInsert } from "@/integrations/supabase/types";
import type { useAuditLog } from "@/hooks/useAuditLog";
import type { IncidentRow } from "@/hooks/useIncidents";
import { CloseIncidentModal } from "./CloseIncidentModal";

type FollowUp = Tables<"incident_followups"> & {
  assignee: { name: string; name_zh: string | null } | null;
  completer: { name: string; name_zh: string | null } | null;
};

type Severity = Enums<"incident_severity">;
type Status = Enums<"incident_status">;
type StaffRole = Enums<"staff_role">;

const SEVERITY_TONE: Record<Severity, "success" | "warning" | "error"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error",
  CRITICAL: "error",
};
const STATUS_TONE: Record<Status, "warning" | "info" | "neutral"> = {
  OPEN: "warning",
  UNDER_REVIEW: "info",
  CLOSED: "neutral",
};

interface IncidentDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  incident: IncidentRow | null;
  branchId: string;
  staffId: string | null;
  staffRole: StaffRole | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function IncidentDetailDrawer({
  open, onClose, incident, branchId, staffId, staffRole, logAction,
}: IncidentDetailDrawerProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"details" | "followups">("details");
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loadingFU, setLoadingFU] = useState(false);
  const [showAddFU, setShowAddFU] = useState(false);
  const [fuAction, setFuAction] = useState("");
  const [fuDue, setFuDue] = useState(todayISO());
  const [fuSaving, setFuSaving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const canManageStatus =
    staffRole === "SYSTEM_ADMIN" || staffRole === "BRANCH_ADMIN" || staffRole === "SENIOR_NURSE";

  useEffect(() => {
    if (!open) {
      setTab("details");
      setShowAddFU(false);
    }
  }, [open]);

  const fetchFollowUps = async () => {
    if (!incident) return;
    setLoadingFU(true);
    const { data, error } = await supabase
      .from("incident_followups")
      .select("*, assignee:assigned_to(name, name_zh), completer:completed_by(name, name_zh)")
      .eq("incident_id", incident.id)
      .order("due_at", { ascending: true });
    if (!error) setFollowUps((data ?? []) as unknown as FollowUp[]);
    setLoadingFU(false);
  };

  useEffect(() => {
    if (open && incident && tab === "followups") {
      void fetchFollowUps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, incident?.id, tab]);

  const handleStartReview = async () => {
    if (!incident || !staffId) return;
    setStatusBusy(true);
    try {
      const before = { status: incident.status };
      const after = { status: "UNDER_REVIEW" as Status };
      const { error } = await supabase.from("incidents").update(after).eq("id", incident.id);
      if (error) throw error;
      await logAction({
        action: "INCIDENT_UPDATED",
        entity_type: "incidents",
        entity_id: incident.id,
        branch_id: branchId,
        before_state: before,
        after_state: after,
      });
      void qc.invalidateQueries({ queryKey: ["incidents"] });
      toast.success(t("incidents.updateSuccess"));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setStatusBusy(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!incident || !staffId) return;
    if (!fuAction.trim()) return;
    setFuSaving(true);
    try {
      const insertRow: TablesInsert<"incident_followups"> = {
        incident_id: incident.id,
        branch_id: branchId,
        action: fuAction.trim(),
        due_at: new Date(`${fuDue}T23:59:00`).toISOString(),
        assigned_to: staffId,
      };
      const { data, error } = await supabase
        .from("incident_followups")
        .insert(insertRow)
        .select()
        .single();
      if (error) throw error;
      await logAction({
        action: "INCIDENT_FOLLOWUP_ADDED",
        entity_type: "incident_followups",
        entity_id: data.id,
        branch_id: branchId,
        after_state: data as unknown as Record<string, unknown>,
        metadata: { incident_id: incident.id },
      });
      toast.success(t("incidents.followUpSuccess"));
      setShowAddFU(false);
      setFuAction("");
      setFuDue(todayISO());
      await fetchFollowUps();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setFuSaving(false);
    }
  };

  const handleCompleteFollowUp = async (fu: FollowUp) => {
    if (!staffId) return;
    try {
      const after = { completed_at: new Date().toISOString(), completed_by: staffId };
      const { error } = await supabase.from("incident_followups").update(after).eq("id", fu.id);
      if (error) throw error;
      await logAction({
        action: "INCIDENT_FOLLOWUP_COMPLETED",
        entity_type: "incident_followups",
        entity_id: fu.id,
        branch_id: branchId,
        before_state: { completed_at: null },
        after_state: after,
      });
      toast.success(t("incidents.followUpCompleteSuccess"));
      await fetchFollowUps();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (!incident) return null;

  const sev = incident.severity;
  const isHighSeverity = sev === "HIGH" || sev === "CRITICAL";

  const footer =
    incident.status === "OPEN" && canManageStatus ? (
      <Button variant="soft" loading={statusBusy} onClick={handleStartReview}>
        {t("incidents.detail")} → {t("incidents.status.UNDER_REVIEW")}
      </Button>
    ) : incident.status === "UNDER_REVIEW" && canManageStatus ? (
      <Button variant="destructive" onClick={() => setCloseOpen(true)}>
        {t("incidents.closeIncident")}
      </Button>
    ) : null;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width={600}
        title={
          <Inline gap={2} align="center">
            <span style={{ fontFamily: "monospace" }}>{incident.incident_ref}</span>
            <Badge tone={SEVERITY_TONE[sev]} emphasis={sev === "CRITICAL" ? "strong" : "subtle"}>
              {t(`incidents.severity.${sev}`)}
            </Badge>
            <Badge tone={STATUS_TONE[incident.status]}>{t(`incidents.status.${incident.status}`)}</Badge>
          </Inline>
        }
        footer={footer}
      >
        <Stack gap={4}>
          <Tabs
            style="line"
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            items={[
              { value: "details", label: t("incidents.tabs.details") },
              { value: "followups", label: t("incidents.tabs.followUps") },
            ]}
          />

          {tab === "details" && (
            <Stack gap={3}>
              {isHighSeverity && (
                <Alert severity="warning" description={t("incidents.highSeverityAlert")} />
              )}
              <Field label={t("incidents.ref")} value={<span style={{ fontFamily: "monospace" }}>{incident.incident_ref}</span>} />
              <Field label={t("incidents.detail")} value={t(`incidents.type.${incident.type}`)} />
              <Field label={t("incidents.occurredAt")} value={formatDateTime(incident.occurred_at)} />
              <Field
                label={t("incidents.location")}
                value={incident.locations ? `${incident.locations.code} · ${incident.locations.name}` : "—"}
              />
              <Field
                label={t("incidents.reporter")}
                value={incident.reporter ? incident.reporter.name_zh ?? incident.reporter.name : "—"}
              />
              <Divider />
              <Stack gap={1}>
                <Text size="label" color="tertiary">{t("incidents.description")}</Text>
                <Text size="md">{incident.description}</Text>
              </Stack>
              {incident.immediate_action && (
                <Stack gap={1}>
                  <Text size="label" color="tertiary">{t("incidents.immediateAction")}</Text>
                  <Surface padding="sm">
                    <Text size="sm">{incident.immediate_action}</Text>
                  </Surface>
                </Stack>
              )}
              {incident.follow_up_due_at && (
                <Field label={t("incidents.followUpDue")} value={formatDate(incident.follow_up_due_at)} />
              )}
              {incident.status === "CLOSED" && (
                <>
                  <Divider />
                  <Field label={t("incidents.closedAt")} value={formatDateTime(incident.closed_at)} />
                  <Field
                    label={t("incidents.reporter")}
                    value={incident.closer ? incident.closer.name_zh ?? incident.closer.name : "—"}
                  />
                  {incident.closure_notes && (
                    <Stack gap={1}>
                      <Text size="label" color="tertiary">{t("incidents.closureNotes")}</Text>
                      <Surface padding="sm">
                        <Text size="sm">{incident.closure_notes}</Text>
                      </Surface>
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          )}

          {tab === "followups" && (
            <Stack gap={3}>
              <Inline justify="between" align="center">
                <Text size="label" color="tertiary">{t("incidents.followUps")}</Text>
                {staffId && incident.status !== "CLOSED" && (
                  <Button variant="soft" size="compact" onClick={() => setShowAddFU((v) => !v)}>
                    {t("incidents.addFollowUp")}
                  </Button>
                )}
              </Inline>

              {showAddFU && staffId && (
                <Surface padding="sm">
                  <Stack gap={2}>
                    <FormField label={t("incidents.followUpAction")} required>
                      <TextField value={fuAction} onChange={(e) => setFuAction(e.target.value)} />
                    </FormField>
                    <FormField label={t("incidents.followUpDueAt")} required>
                      <TextField type="date" value={fuDue} onChange={(e) => setFuDue(e.target.value)} />
                    </FormField>
                    <FormField label={t("incidents.followUpAssigned")}>
                      <TextField value={t("tasks.myself")} disabled readOnly />
                    </FormField>
                    <Inline gap={2} justify="end">
                      <Button variant="ghost" size="compact" onClick={() => setShowAddFU(false)}>
                        {t("actions.cancel")}
                      </Button>
                      <Button variant="primary" size="compact" loading={fuSaving} onClick={handleAddFollowUp}>
                        {t("actions.save")}
                      </Button>
                    </Inline>
                  </Stack>
                </Surface>
              )}

              {loadingFU ? (
                <div className="flex items-center justify-center" style={{ minHeight: 100 }}>
                  <Spinner size="md" />
                </div>
              ) : followUps.length === 0 ? (
                <Text size="sm" color="tertiary">{t("incidents.noFollowUps")}</Text>
              ) : (
                <Stack gap={2}>
                  {followUps.map((fu) => (
                    <Surface key={fu.id} padding="sm">
                      <Stack gap={1}>
                        <Inline justify="between" align="start">
                          <Stack gap={1}>
                            <Text size="md" className="font-semibold">{fu.action}</Text>
                            <Text size="sm" color="secondary">
                              {formatDate(fu.due_at)}
                              {fu.assignee && ` · ${fu.assignee.name_zh ?? fu.assignee.name}`}
                            </Text>
                          </Stack>
                          {fu.completed_at ? (
                            <Badge tone="success">
                              {t("incidents.followUpCompleted")} · {formatDate(fu.completed_at)}
                            </Badge>
                          ) : (
                            <Inline gap={2} align="center">
                              <Badge tone="warning">{t("incidents.status.OPEN")}</Badge>
                              {staffId && (
                                <Button variant="ghost" size="compact" onClick={() => handleCompleteFollowUp(fu)}>
                                  {t("incidents.followUpComplete")}
                                </Button>
                              )}
                            </Inline>
                          )}
                        </Inline>
                      </Stack>
                    </Surface>
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </Stack>
      </Drawer>

      {staffId && (
        <CloseIncidentModal
          open={closeOpen}
          onClose={() => setCloseOpen(false)}
          incidentId={incident.id}
          branchId={branchId}
          staffId={staffId}
          currentStatus={incident.status}
          onClosed={onClose}
          logAction={logAction}
        />
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Inline justify="between" align="start" className="w-full">
      <Text size="sm" color="tertiary">{label}</Text>
      <Text size="sm" className="text-right">{value}</Text>
    </Inline>
  );
}
