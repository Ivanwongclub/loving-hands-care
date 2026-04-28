import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Stack, Inline, Text, Heading, Badge, Button, Card,
  EmptyState, Avatar, StatusDot,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { EMARRow } from "@/hooks/useEMARRecords";

type ResuscitationStatus = "FULL_RESUSCITATION" | "DNACPR" | "AD_LIMITED";

interface AllergyEntry {
  id?: string;
  drug?: string;
  severity?: string;
  is_active?: boolean;
}

export interface PassModeResident {
  id: string;
  name: string;
  name_zh: string | null;
  room?: string | null;
  photo_storage_path: string | null;
  photo_declined: boolean;
  resuscitation_status: ResuscitationStatus | string | null;
  allergies: AllergyEntry[] | null;
}

export type PassModeRecord = EMARRow & {
  residents: PassModeResident | null;
};

interface PassModeViewProps {
  records: PassModeRecord[];
  sessionCompleted: Set<string>;
  onAdminister: (record: PassModeRecord) => void;
  onEndSession: () => void;
  onClearCompleted: () => void;
}

function formatTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function PassModeView({
  records,
  sessionCompleted,
  onAdminister,
  onEndSession,
  onClearCompleted,
}: PassModeViewProps) {
  const { t } = useTranslation();

  const pendingCount = records.filter((r) => r.status === "DUE" || r.status === "LATE").length;
  const overdueCount = records.filter((r) => r.status === "LATE").length;
  const completedCount = sessionCompleted.size;

  const sortedResidents = useMemo(() => {
    const map = new Map<string, { resident: PassModeResident | null; records: PassModeRecord[] }>();
    for (const rec of records) {
      const key = rec.resident_id;
      if (!map.has(key)) {
        map.set(key, { resident: rec.residents, records: [] });
      }
      map.get(key)!.records.push(rec);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aHasLate = a.records.some((r) => r.status === "LATE");
      const bHasLate = b.records.some((r) => r.status === "LATE");
      if (aHasLate && !bHasLate) return -1;
      if (!aHasLate && bHasLate) return 1;
      const aMin = Math.min(...a.records.map((r) => new Date(r.due_at).getTime()));
      const bMin = Math.min(...b.records.map((r) => new Date(r.due_at).getTime()));
      return aMin - bMin;
    });
  }, [records]);

  // Empty: no records at all
  if (records.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          title={t("emar.pass.noPendingMeds")}
          description={t("emar.pass.allCaughtUp")}
        />
      </Card>
    );
  }

  // All pending done in session
  const allDoneInSession = pendingCount === 0 && completedCount > 0;

  return (
    <Stack gap={4}>
      {/* Session bar */}
      <Card padding="md">
        <Inline justify="between" align="center" className="w-full" wrap>
          <Stack gap={1}>
            <Heading level={3}>{t("emar.pass.sessionTitle")}</Heading>
            <Inline gap={3} align="center" wrap>
              <Inline gap={1} align="center">
                <StatusDot tone="warning" />
                <Text size="sm" color="secondary">
                  {pendingCount} {t("emar.pass.pending")}
                </Text>
              </Inline>
              <Inline gap={1} align="center">
                <StatusDot tone="error" />
                <Text size="sm" color="secondary">
                  {overdueCount} {t("emar.pass.overdue")}
                </Text>
              </Inline>
              <Inline gap={1} align="center">
                <StatusDot tone="success" />
                <Text size="sm" color="secondary">
                  {completedCount} {t("emar.pass.completed")}
                </Text>
              </Inline>
            </Inline>
          </Stack>
          <Inline gap={2} align="center">
            <Button
              variant="ghost"
              size="compact"
              onClick={onClearCompleted}
              disabled={completedCount === 0}
            >
              {t("emar.pass.clearCompleted")}
            </Button>
            <Button variant="ghost" size="compact" onClick={onEndSession}>
              {t("emar.pass.endSession")}
            </Button>
          </Inline>
        </Inline>
      </Card>

      {allDoneInSession ? (
        <Card padding="lg">
          <EmptyState
            title={t("emar.pass.sessionComplete")}
            description={t("emar.pass.allMedsAdministered", { count: completedCount })}
            action={
              <Button variant="primary" onClick={onEndSession}>
                {t("emar.pass.endSession")}
              </Button>
            }
          />
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {sortedResidents.map(({ resident, records: residentRecords }) => {
            const allInSession = residentRecords.every((r) => sessionCompleted.has(r.id));
            return (
              <TallCard
                key={resident?.id ?? residentRecords[0].resident_id}
                resident={resident}
                records={residentRecords}
                isDismissed={allInSession}
                onAdminister={onAdminister}
              />
            );
          })}
        </div>
      )}
    </Stack>
  );
}

/* ─────────── TallCard ─────────── */

interface TallCardProps {
  resident: PassModeResident | null;
  records: PassModeRecord[];
  isDismissed: boolean;
  onAdminister: (record: PassModeRecord) => void;
}

function TallCard({ resident, records, isDismissed, onAdminister }: TallCardProps) {
  const { t } = useTranslation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const photoPath = resident?.photo_storage_path ?? null;
  const photoDeclined = resident?.photo_declined ?? false;

  useEffect(() => {
    let cancelled = false;
    if (!photoPath || photoDeclined) {
      setPhotoUrl(null);
      return;
    }
    supabase.storage
      .from("resident-photos")
      .createSignedUrl(photoPath, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setPhotoUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [photoPath, photoDeclined]);

  const nameZh = resident?.name_zh ?? "";
  const nameEn = resident?.name ?? "";
  const displayName = nameZh || nameEn || "—";

  const activeAllergies = (resident?.allergies ?? [])
    .filter((a) => a.is_active !== false && a.drug)
    .slice(0, 2);

  const nextRecord = records.find((r) => r.status === "DUE" || r.status === "LATE");
  const allDone = !nextRecord;
  const hasLate = records.some((r) => r.status === "LATE");

  const cardInner = (
    <Card padding="none" className="overflow-hidden">
      <Stack gap={0}>
        {/* Identity */}
        <div style={{ padding: 16, paddingBottom: 12 }}>
          <Stack gap={2}>
            <Inline gap={3} align="center">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt=""
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "1px solid var(--border-default)",
                  }}
                />
              ) : (
                <Avatar name={nameZh || nameEn || "?"} size="md" />
              )}
              <Stack gap={0}>
                <Text size="md" className="font-semibold">{displayName}</Text>
                {nameZh && nameEn && nameZh !== nameEn && (
                  <Text size="sm" color="tertiary">{nameEn}</Text>
                )}
              </Stack>
            </Inline>

            <Inline gap={1} wrap>
              {resident?.resuscitation_status === "DNACPR" && (
                <Badge tone="error" emphasis="strong">DNACPR</Badge>
              )}
              {resident?.resuscitation_status === "AD_LIMITED" && (
                <Badge tone="warning" emphasis="strong">
                  {t("residents.resuscitation.AD_LIMITED")}
                </Badge>
              )}
              {activeAllergies.map((a, i) => (
                <Badge
                  key={a.id ?? `${a.drug}-${i}`}
                  tone={
                    a.severity === "ANAPHYLAXIS" || a.severity === "SEVERE"
                      ? "error"
                      : "warning"
                  }
                >
                  {a.drug}
                </Badge>
              ))}
              {!photoPath && !photoDeclined && (
                <Badge tone="warning">📷 {t("emar.pass.photoMissing")}</Badge>
              )}
            </Inline>
          </Stack>
        </div>

        <div style={{ borderTop: "1px solid var(--border-default)" }} />

        {/* Medications */}
        <div style={{ padding: 16, paddingTop: 12, paddingBottom: 12 }}>
          <Stack gap={2}>
            <Text
              size="xs"
              color="tertiary"
              style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              {t("emar.pass.dueMedications")} ({records.length})
            </Text>

            {records.map((rec, i) => {
              const isLate = rec.status === "LATE";
              const minutesLate = isLate
                ? Math.max(0, Math.floor((Date.now() - new Date(rec.due_at).getTime()) / 60000))
                : 0;
              const isAdministered = rec.status === "ADMINISTERED";
              const drugLabel =
                rec.order?.drug_name_zh ?? rec.order?.drug_name ?? "—";
              const dose = rec.order?.dose ?? "";
              const route = rec.order?.route ?? "";

              return (
                <Stack
                  key={rec.id}
                  gap={1}
                  style={{
                    paddingTop: i > 0 ? 8 : 0,
                    paddingBottom: 8,
                    borderBottom:
                      i < records.length - 1
                        ? "1px solid var(--border-default)"
                        : "none",
                    opacity: isAdministered ? 0.4 : 1,
                  }}
                >
                  <Text size="sm" className="font-medium">
                    {formatTime(rec.due_at)} {drugLabel} {dose}
                  </Text>
                  <Text
                    size="xs"
                    style={{
                      color: isLate
                        ? "var(--status-error-accent)"
                        : "var(--text-secondary)",
                      fontWeight: isLate ? 500 : 400,
                    }}
                  >
                    {route || t("emar.routes.ORAL")}
                    {isLate && ` · ${t("emar.pass.lateMinutes", { count: minutesLate })}`}
                    {isAdministered && ` · ✓ ${t("emar.emarStatus.ADMINISTERED")}`}
                  </Text>
                  {!isAdministered && (
                    <Inline gap={3} align="center">
                      <Inline gap={1} align="center">
                        <StatusDot tone={rec.barcode_verified ? "success" : "neutral"} />
                        <Text size="xs" color="tertiary">Barcode</Text>
                      </Inline>
                      <Inline gap={1} align="center">
                        <StatusDot tone={rec.shift_pin_verified ? "success" : "neutral"} />
                        <Text size="xs" color="tertiary">PIN</Text>
                      </Inline>
                    </Inline>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </div>

        <div style={{ borderTop: "1px solid var(--border-default)" }} />

        {/* Action */}
        <div style={{ padding: 12 }}>
          <Button
            variant={allDone ? "ghost" : hasLate ? "destructive" : "primary"}
            size="default"
            fullWidth
            disabled={allDone}
            onClick={() => nextRecord && onAdminister(nextRecord)}
          >
            {allDone
              ? `✓ ${t("emar.pass.allDone")}`
              : t("emar.pass.administer")}
          </Button>
        </div>
      </Stack>
    </Card>
  );

  if (!isDismissed) return cardInner;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ opacity: 0.38, pointerEvents: "none" }}>{cardInner}</div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "var(--status-success-bg)",
          color: "var(--status-success-text)",
          padding: "6px 14px",
          borderRadius: "var(--radius-pill)",
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        ✓ {t("emar.pass.completed")}
      </div>
    </div>
  );
}
