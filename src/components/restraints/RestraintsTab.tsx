import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Card, Stack, Inline, Text, Heading, Button, Surface, Spinner, EmptyState, Badge,
  Alert, Divider, Modal,
} from "@/components/hms";
import { useRestraintRecords, useLatestObservation, type RestraintRecordRow } from "@/hooks/useRestraints";
import type { useAuditLog } from "@/hooks/useAuditLog";
import { AddRestraintModal } from "./AddRestraintModal";
import { ObservationModal } from "./ObservationModal";
import { DiscontinueModal } from "./DiscontinueModal";

interface RestraintsTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  staffRole: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}
function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function daysUntil(dateISO: string | null | undefined): number {
  if (!dateISO) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((new Date(dateISO).getTime() - today.getTime()) / 86400000);
}
function monthsBetween(a: string, b: string | null): string {
  const start = new Date(a).getTime();
  const end = (b ? new Date(b) : new Date()).getTime();
  const m = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30)));
  return `${m}`;
}

export function RestraintsTab({
  residentId, branchId, staffId, staffRole, logAction,
}: RestraintsTabProps) {
  const { t } = useTranslation();
  const { activeRecords, historyRecords, isLoading, error } = useRestraintRecords(residentId);

  const [addOpen, setAddOpen] = useState(false);
  const [observingId, setObservingId] = useState<string | null>(null);
  const [discontinuingId, setDiscontinuingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<RestraintRecordRow | null>(null);

  const canEdit = staffRole === "SENIOR_NURSE" || staffRole === "BRANCH_ADMIN" || staffRole === "SYSTEM_ADMIN";
  const canObserve = !!staffId;

  const reviewDueCount = useMemo(
    () => activeRecords.filter((r) => daysUntil(r.review_due_date) <= 7).length,
    [activeRecords],
  );

  if (isLoading) {
    return (
      <Card padding="lg">
        <div className="flex justify-center"><Spinner size="lg" /></div>
      </Card>
    );
  }
  if (error) {
    return <Alert severity="error" title={error.message} />;
  }

  return (
    <Stack gap={4} data-feedback-id="resident-tab-restraints">
      <Inline justify="between" align="center">
        <Heading level={3}>{t("restraints.title")}</Heading>
        {canEdit && (
          <Button variant="primary" onClick={() => setAddOpen(true)} disabled={!staffId}>
            {t("restraints.addRecord")}
          </Button>
        )}
      </Inline>

      {reviewDueCount > 0 && (
        <Alert
          severity="warning"
          title={t("restraints.reviewDue", { count: reviewDueCount })}
        />
      )}

      {activeRecords.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title={t("restraints.noRecords")}
            description={t("restraints.noRecordsDescription")}
            action={
              canEdit && staffId ? (
                <Button variant="primary" onClick={() => setAddOpen(true)}>
                  {t("restraints.addRecord")}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Stack gap={3}>
          <Text size="label" color="tertiary">{t("restraints.active")} ({activeRecords.length})</Text>
          {activeRecords.map((rec) => (
            <ActiveRestraintCard
              key={rec.id}
              record={rec}
              canEdit={canEdit}
              canObserve={canObserve}
              onAddObservation={() => setObservingId(rec.id)}
              onDiscontinue={() => setDiscontinuingId(rec.id)}
            />
          ))}
        </Stack>
      )}

      {historyRecords.length > 0 && (
        <Card padding="md">
          <Stack gap={3}>
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex items-center gap-2 text-left"
              style={{ color: "var(--text-primary)" }}
            >
              {historyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Heading level={3}>{t("restraints.history")}</Heading>
              <Badge tone="neutral">{historyRecords.length}</Badge>
            </button>
            {historyOpen && (
              <Stack gap={2}>
                {historyRecords.map((r) => (
                  <DiscontinuedCard key={r.id} record={r} onClick={() => setDetailRecord(r)} />
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      {staffId && (
        <AddRestraintModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}
      {staffId && (
        <ObservationModal
          open={!!observingId}
          onClose={() => setObservingId(null)}
          restraintRecordId={observingId}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}
      {staffId && (
        <DiscontinueModal
          open={!!discontinuingId}
          onClose={() => setDiscontinuingId(null)}
          recordId={discontinuingId}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}

      <Modal
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        title={detailRecord ? t(`restraints.types.${detailRecord.restraint_type}`) : ""}
        size="lg"
        footer={<Button variant="soft" onClick={() => setDetailRecord(null)}>{t("actions.close") || "Close"}</Button>}
      >
        {detailRecord && <RestraintDetail record={detailRecord} />}
      </Modal>
    </Stack>
  );
}

function ActiveRestraintCard({
  record, canEdit, canObserve, onAddObservation, onDiscontinue,
}: {
  record: RestraintRecordRow;
  canEdit: boolean;
  canObserve: boolean;
  onAddObservation: () => void;
  onDiscontinue: () => void;
}) {
  const { t } = useTranslation();
  const { observation } = useLatestObservation(record.id);

  const days = daysUntil(record.review_due_date);
  const reviewTone: "error" | "warning" | "neutral" =
    days <= 0 ? "error" : days <= 7 ? "warning" : "neutral";
  const reviewLabel = days <= 0
    ? t("restraints.reviewOverdue")
    : t("restraints.reviewDueIn", { days });

  return (
    <Card padding="md">
      <Stack gap={3}>
        <Inline justify="between" align="start" className="w-full">
          <Stack gap={1}>
            <Inline gap={2} wrap>
              <Badge tone="info">{t(`restraints.types.${record.restraint_type}`)}</Badge>
              {record.restraint_type === "CHEMICAL" && (
                <Badge tone="error" emphasis="strong">{t("restraints.chemicalRestraintWarning")}</Badge>
              )}
              <Badge tone={reviewTone}>{reviewLabel}</Badge>
            </Inline>
            <Text size="sm" color="tertiary">
              {t("restraints.startDate")}: {formatDate(record.start_date)}
              {record.end_date && ` → ${formatDate(record.end_date)}`}
              {" · "}{t("restraints.reviewDueDate")}: {formatDate(record.review_due_date)}
            </Text>
            {record.restraint_specification && (
              <Text size="sm" color="secondary">{record.restraint_specification}</Text>
            )}
          </Stack>
          <Inline gap={2}>
            {canObserve && (
              <Button variant="ghost" size="compact" onClick={onAddObservation}>
                {t("restraints.addObservation")}
              </Button>
            )}
            {canEdit && (
              <Button variant="soft" size="compact" onClick={onDiscontinue}>
                {t("restraints.discontinue")}
              </Button>
            )}
          </Inline>
        </Inline>

        <Surface padding="sm">
          <Stack gap={1}>
            <Text size="label" color="tertiary">{t("restraints.assessor")}</Text>
            <Text size="sm">
              {record.assessor?.name_zh ?? record.assessor?.name ?? "—"}
              {" · "}{t(`restraints.assessorRoles.${record.assessment_by_role}`)}
              {" · "}{formatDate(record.assessment_date)}
            </Text>
            {record.consent_by && (
              <Text size="sm" color="secondary">
                {t("restraints.consenter")}: {t(`restraints.consentBy.${record.consent_by}`)}
                {record.consent_signatory_name && ` (${record.consent_signatory_name})`}
              </Text>
            )}
          </Stack>
        </Surface>

        <Divider />

        <Stack gap={1}>
          <Inline justify="between" align="center">
            <Text size="label" color="tertiary">{t("restraints.lastObservation")}</Text>
            {canObserve && (
              <button
                type="button"
                onClick={onAddObservation}
                className="type-body-sm"
                style={{ color: "var(--text-link)" }}
              >
                {t("restraints.addObservation")}
              </button>
            )}
          </Inline>
          {observation ? (
            <Inline gap={2} wrap>
              <Text size="sm">{formatDateTime(observation.observed_at)}</Text>
              <Badge tone={observation.skin_condition === "NORMAL" ? "success" : "warning"}>
                {t(`restraints.skinCondition.${observation.skin_condition}`)}
              </Badge>
              {!observation.circulation_normal && (
                <Badge tone="error">{t("restraints.obsCirculation")}</Badge>
              )}
              {observation.in_use ? (
                <Badge tone="info">{t("restraints.obsInUse")}</Badge>
              ) : (
                <Badge tone="neutral">—</Badge>
              )}
            </Inline>
          ) : (
            <Text size="sm" color="tertiary">—</Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

function DiscontinuedCard({
  record, onClick,
}: { record: RestraintRecordRow; onClick: () => void }) {
  const { t } = useTranslation();
  const months = monthsBetween(record.start_date, record.discontinued_date ?? record.end_date);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
      style={{ opacity: 0.85 }}
    >
      <Surface padding="sm">
        <Stack gap={1}>
          <Inline gap={2} wrap>
            <Badge tone="neutral">{t(`restraints.types.${record.restraint_type}`)}</Badge>
            <Text size="sm">
              {formatDate(record.start_date)} → {formatDate(record.discontinued_date ?? record.end_date)}
              {" "}({months} {t("residents.monthsShort") || "mo"})
            </Text>
          </Inline>
          {record.discontinued_reason && (
            <Text size="sm" color="secondary">{record.discontinued_reason}</Text>
          )}
          {record.assessor && (
            <Text size="sm" color="tertiary">
              {t("restraints.assessor")}: {record.assessor.name_zh ?? record.assessor.name}
            </Text>
          )}
        </Stack>
      </Surface>
    </button>
  );
}

function RestraintDetail({ record }: { record: RestraintRecordRow }) {
  const { t } = useTranslation();
  return (
    <Stack gap={3}>
      <Inline gap={2} wrap>
        <Badge tone="info">{t(`restraints.types.${record.restraint_type}`)}</Badge>
        <Badge tone="neutral">{record.status}</Badge>
      </Inline>
      <Row label={t("restraints.startDate")} value={formatDate(record.start_date)} />
      <Row label={t("restraints.endDate")} value={formatDate(record.end_date)} />
      <Row label={t("restraints.reviewDueDate")} value={formatDate(record.review_due_date)} />
      <Row label={t("restraints.contributingFactors")} value={record.contributing_factors} />
      <Row label={t("restraints.alternativesTried")} value={record.alternatives_tried} />
      <Row
        label={t("restraints.assessor")}
        value={`${record.assessor?.name_zh ?? record.assessor?.name ?? "—"} · ${t(`restraints.assessorRoles.${record.assessment_by_role}`)}`}
      />
      {record.consent_by && (
        <Row
          label={t("restraints.consenter")}
          value={`${t(`restraints.consentBy.${record.consent_by}`)} · ${record.consent_signatory_name ?? ""} · ${formatDate(record.consent_date)}`}
        />
      )}
      {record.doctor_order_required && (
        <Row label={t("restraints.doctorName")} value={`${record.doctor_name ?? "—"} · ${formatDate(record.doctor_order_date)}`} />
      )}
      {record.discontinued_date && (
        <Row label={t("restraints.discontinueReason")} value={`${formatDate(record.discontinued_date)} · ${record.discontinued_reason ?? ""}`} />
      )}
      {record.notes && <Row label={t("residents.notes") || "Notes"} value={record.notes} />}
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Stack gap={1}>
      <Text size="label" color="tertiary">{label}</Text>
      <Text size="sm">{value || "—"}</Text>
    </Stack>
  );
}
