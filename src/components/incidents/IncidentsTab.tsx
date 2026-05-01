import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card, Stack, Inline, Text, Heading, Button, Surface, Spinner, EmptyState, Badge, Alert,
} from "@/components/hms";
import type { Enums } from "@/integrations/supabase/types";
import { useIncidents, type IncidentRow } from "@/hooks/useIncidents";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import type { useAuditLog } from "@/hooks/useAuditLog";
import { NewIncidentModal } from "./NewIncidentModal";
import { IncidentDetailDrawer } from "./IncidentDetailDrawer";
import { CloseIncidentModal } from "./CloseIncidentModal";

interface IncidentsTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

type Severity = Enums<"incident_severity">;
type Status = Enums<"incident_status">;

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

function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

export function IncidentsTab({ residentId, branchId, staffId, logAction }: IncidentsTabProps) {
  const { t } = useTranslation();
  const { staff } = useCurrentStaff();
  const { incidents, isLoading } = useIncidents({ branchId, residentId });

  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<IncidentRow | null>(null);
  const [closing, setClosing] = useState<IncidentRow | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <Stack gap={4} data-feedback-id="resident-tab-incidents">
      <Inline justify="between" align="center">
        <Heading level={3}>{t("incidents.title")}</Heading>
        <Button variant="primary" onClick={() => setNewOpen(true)} disabled={!staffId}>
          {t("incidents.new")}
        </Button>
      </Inline>

      {incidents.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title={t("incidents.noIncidents")}
            action={
              staffId ? (
                <Button variant="primary" onClick={() => setNewOpen(true)}>{t("incidents.new")}</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Stack gap={3}>
          {incidents.map((inc) => {
            const isHigh = inc.severity === "HIGH" || inc.severity === "CRITICAL";
            const isOpen = inc.status === "OPEN" || inc.status === "UNDER_REVIEW";
            return (
              <Card key={inc.id} padding="md">
                <Stack gap={3}>
                  <Inline justify="between" align="start" className="w-full" wrap>
                    <Inline gap={2} wrap align="center">
                      <Badge tone="neutral">
                        <span style={{ fontFamily: "monospace" }}>{inc.incident_ref}</span>
                      </Badge>
                      <Badge tone="info">{t(`incidents.type.${inc.type}`)}</Badge>
                      <Badge tone={SEVERITY_TONE[inc.severity]} emphasis={inc.severity === "CRITICAL" ? "strong" : "subtle"}>
                        {t(`incidents.severity.${inc.severity}`)}
                      </Badge>
                      <Badge tone={STATUS_TONE[inc.status]}>{t(`incidents.status.${inc.status}`)}</Badge>
                    </Inline>
                  </Inline>

                  {isHigh && <Alert severity="warning" description={t("incidents.highSeverityAlert")} />}

                  <Stack gap={1}>
                    <Text size="sm" color="secondary">
                      {formatDateTime(inc.occurred_at)}
                      {inc.locations && ` · ${inc.locations.code}`}
                    </Text>
                    <Text size="md">{truncate(inc.description, 120)}</Text>
                  </Stack>

                  {inc.immediate_action && (
                    <Surface padding="sm">
                      <Text size="sm" style={{ fontStyle: "italic" }}>
                        {inc.immediate_action}
                      </Text>
                    </Surface>
                  )}

                  <Inline justify="between" align="center" className="w-full" wrap>
                    <Text size="sm" color="tertiary">
                      {t("incidents.reporter")}:{" "}
                      {inc.reporter ? inc.reporter.name_zh ?? inc.reporter.name : "—"}
                    </Text>
                    <Inline gap={2}>
                      <Button variant="ghost" size="compact" onClick={() => setDetail(inc)}>
                        {t("actions.view")}
                      </Button>
                      {isOpen && staffId && (
                        <>
                          <Button variant="ghost" size="compact" onClick={() => setDetail(inc)}>
                            {t("incidents.addFollowUp")}
                          </Button>
                          <Button variant="soft" size="compact" onClick={() => setClosing(inc)}>
                            {t("actions.close")}
                          </Button>
                        </>
                      )}
                    </Inline>
                  </Inline>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}

      {staffId && (
        <NewIncidentModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}
      <IncidentDetailDrawer
        open={!!detail}
        onClose={() => setDetail(null)}
        incident={detail}
        branchId={branchId}
        staffId={staffId}
        staffRole={staff?.role ?? null}
        logAction={logAction}
      />
      {staffId && closing && (
        <CloseIncidentModal
          open={!!closing}
          onClose={() => setClosing(null)}
          incidentId={closing.id}
          branchId={branchId}
          staffId={staffId}
          currentStatus={closing.status}
          logAction={logAction}
        />
      )}
    </Stack>
  );
}
