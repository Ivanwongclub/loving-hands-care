import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  Card, Stack, Inline, Text, Heading, Button, EmptyState, Spinner, Alert, Badge, Modal, Divider,
} from "@/components/hms";
import {
  useVaccinations, calculateSuggestions, type VaccinationRecordRow, type VaccineType,
} from "@/hooks/useVaccinations";
import { AddVaccinationModal } from "./AddVaccinationModal";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface VaccinationsTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  staffRole: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export function VaccinationsTab({
  residentId, branchId, staffId, staffRole, logAction,
}: VaccinationsTabProps) {
  const { t } = useTranslation();
  const { records, isLoading, error, refetch } = useVaccinations(residentId);
  const [addOpen, setAddOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<VaccineType | null>(null);
  const [detail, setDetail] = useState<VaccinationRecordRow | null>(null);

  const canAdd = staffRole === "NURSE" || staffRole === "SENIOR_NURSE" ||
    staffRole === "BRANCH_ADMIN" || staffRole === "SYSTEM_ADMIN";

  const suggestions = useMemo(() => calculateSuggestions(records), [records]);

  if (isLoading) {
    return <div className="flex items-center justify-center" style={{ minHeight: 200 }}><Spinner size="lg" /></div>;
  }
  if (error) {
    return <Alert severity="error" title={error.message} />;
  }

  const openAdd = (type?: VaccineType | null) => {
    setDefaultType(type ?? null);
    setAddOpen(true);
  };

  return (
    <Stack gap={4} data-feedback-id="resident-tab-vaccinations">
      <Inline justify="between" align="center">
        <Heading level={3}>{t("vaccinations.title")}</Heading>
        {canAdd && (
          <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => openAdd(null)}>
            {t("vaccinations.addRecord")}
          </Button>
        )}
      </Inline>

      {suggestions.length > 0 && (
        <Card padding="md">
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("vaccinations.suggested")}</Text>
            <Stack gap={2}>
              {suggestions.map((s, i) => (
                <Inline key={`${s.type}-${i}`} justify="between" align="center">
                  <Stack gap={1}>
                    <Text size="md" className="font-medium">{t(`vaccinations.types.${s.type}`)}</Text>
                    <Text size="sm" color="secondary">
                      {s.reasonKey === "suggestNeverGiven"
                        ? t("vaccinations.suggestNeverGiven")
                        : t("vaccinations.suggestOverdue", { months: s.monthsAgo })}
                    </Text>
                  </Stack>
                  {canAdd && (
                    <Button variant="soft" size="compact" onClick={() => openAdd(s.type)}>
                      {t("vaccinations.addRecord")}
                    </Button>
                  )}
                </Inline>
              ))}
            </Stack>
          </Stack>
        </Card>
      )}

      <Card padding="md">
        <Stack gap={2}>
          <Text size="label" color="tertiary">{t("vaccinations.received")}</Text>
          {records.length === 0 ? (
            <EmptyState
              title={t("vaccinations.noRecords")}
              description={t("vaccinations.noRecordsDescription")}
            />
          ) : (
            <Stack gap={1}>
              {records.map((r, i) => {
                const adminName = r.administered_by_doctor
                  ? `${r.administered_by_doctor} (${t("vaccinations.external")})`
                  : r.administrator
                    ? (r.administrator.name_zh || r.administrator.name)
                    : "—";
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setDetail(r)}
                    style={{
                      textAlign: "left", background: "transparent", border: "none",
                      padding: "10px 8px", cursor: "pointer", borderRadius: "var(--radius-sm)",
                      borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                    }}
                    className="hover:bg-[var(--bg-hover-subtle)]"
                  >
                    <Inline justify="between" align="center" wrap>
                      <Stack gap={1}>
                        <Inline gap={2} align="center" wrap>
                          <Text size="md" className="font-medium">{t(`vaccinations.types.${r.vaccine_type}`)}</Text>
                          {r.vaccine_brand && <Badge tone="neutral">{r.vaccine_brand}</Badge>}
                          {r.adverse_reaction && <Badge tone="warning">{t("vaccinations.adverseReaction")}</Badge>}
                        </Inline>
                        <Text size="sm" color="secondary">{adminName}</Text>
                      </Stack>
                      <Text size="sm" color="tertiary">{fmtDate(r.administered_date)}</Text>
                    </Inline>
                  </button>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Card>

      {addOpen && (
        <AddVaccinationModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          defaultType={defaultType}
          logAction={logAction}
          onSaved={async () => { await refetch(); }}
        />
      )}

      {detail && (
        <Modal
          open={!!detail}
          onClose={() => setDetail(null)}
          title={t("vaccinations.detailTitle")}
          size="md"
          footer={<Button variant="ghost" onClick={() => setDetail(null)}>{t("actions.close", { defaultValue: "Close" })}</Button>}
        >
          <Stack gap={2}>
            <DetailRow label={t("vaccinations.vaccineType")} value={t(`vaccinations.types.${detail.vaccine_type}`)} />
            <DetailRow label={t("vaccinations.vaccineBrand")} value={detail.vaccine_brand || "—"} />
            <DetailRow label={t("vaccinations.batchNumber")} value={detail.batch_number} />
            <DetailRow label={t("vaccinations.administeredDate")} value={fmtDate(detail.administered_date)} />
            <DetailRow
              label={t("vaccinations.administrator")}
              value={detail.administered_by_doctor
                ? `${detail.administered_by_doctor} (${t("vaccinations.external")})`
                : detail.administrator
                  ? `${detail.administrator.name_zh || detail.administrator.name} (${t("vaccinations.internal")})`
                  : "—"}
            />
            <DetailRow label={t("vaccinations.injectionSite")}
              value={detail.injection_site ? t(`vaccinations.sites.${detail.injection_site}`) : "—"} />
            <Divider />
            <DetailRow label={t("vaccinations.consentObtained")} value={detail.consent_obtained ? "✓" : "✗"} />
            <DetailRow label={t("vaccinations.consentBy")} value={detail.consent_by || "—"} />
            <DetailRow label={t("vaccinations.consentDate")} value={fmtDate(detail.consent_date)} />
            <Divider />
            <DetailRow label={t("vaccinations.adverseReaction")} value={detail.adverse_reaction ? "⚠️ Yes" : "No"} />
            {detail.adverse_reaction && (
              <DetailRow label={t("vaccinations.adverseReactionNotes")} value={detail.adverse_reaction_notes || "—"} />
            )}
            <Divider />
            <DetailRow label={t("vaccinations.nextDoseDue")} value={fmtDate(detail.next_dose_due_date)} />
            <DetailRow label={t("vaccinations.expiryRelevantDate")} value={fmtDate(detail.expiry_relevant_date)} />
            {detail.notes && <DetailRow label={t("vaccinations.notes")} value={detail.notes} />}
          </Stack>
        </Modal>
      )}
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Inline justify="between" align="start" gap={3}>
      <Text size="sm" color="tertiary">{label}</Text>
      <Text size="sm" className="text-right" style={{ maxWidth: "60%" }}>{value}</Text>
    </Inline>
  );
}
