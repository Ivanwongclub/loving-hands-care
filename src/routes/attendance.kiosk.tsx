import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, WifiOff, UserCog } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { KioskShell } from "@/components/shells/KioskShell";
import {
  Stack, Inline, Heading, Text, Button, Badge, Banner,
  Drawer, SearchField, Radio, TextField, FormField, Avatar, Spinner,
  ConfirmDialog,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { useResidents } from "@/hooks/useResidents";
import { useAuditLog } from "@/hooks/useAuditLog";
import {
  enqueueScan, getQueuedScans, removeFromQueue, getQueueCount,
} from "@/lib/kioskQueue";

export const Route = createFileRoute("/attendance/kiosk")({
  component: KioskPage,
});

type KioskState =
  | "STANDBY"
  | "SUCCESS_CHECKIN"
  | "SUCCESS_CHECKOUT"
  | "ERROR"
  | "OFFLINE_QUEUED"
  | "MANUAL_OVERRIDE";

interface ScanResultDisplay {
  residentNameZh: string;
  residentName: string;
  photoUrl: string | null;
  time: string;
}

const SCANNER_ELEMENT_ID = "qr-reader";

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatHHmm(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function KioskPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { branches } = useBranches();
  const branch = branches[0] ?? null;
  const branchId = branch?.id ?? null;

  const [state, setState] = useState<KioskState>("STANDBY");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [resultDisplay, setResultDisplay] = useState<ScanResultDisplay | null>(null);
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queueCount, setQueueCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [pendingHighRiskCheckOut, setPendingHighRiskCheckOut] = useState<{
    enrollmentId: string;
    residentName: string;
    wanderingNotes: string | null;
    photoPath: string | null;
    eventTime: string;
    qrCodeUUID?: string;
    manual?: { residentId: string; reason: string };
  } | null>(null);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const processingRef = useRef<boolean>(false);
  const stateTimerRef = useRef<number | null>(null);

  const refreshQueueCount = useCallback(async () => {
    try {
      setQueueCount(await getQueueCount());
    } catch {
      /* noop */
    }
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void syncOfflineQueue();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Initial queue count + sync on mount
  useEffect(() => {
    void refreshQueueCount();
    if (online && branchId) void syncOfflineQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Resolve resident photo to a signed URL.
  const getPhotoUrl = useCallback(async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    try {
      const { data } = await supabase.storage
        .from("resident-documents")
        .createSignedUrl(path, 900);
      return data?.signedUrl ?? null;
    } catch {
      return null;
    }
  }, []);

  // Core scan processor. originalEventTime is provided when replaying a queued scan.
  // skipHighRiskGate: when true, bypass the wandering HIGH-risk confirmation (after user confirms).
  const processScan = useCallback(
    async (qrCodeUUID: string, originalEventTime?: string, skipHighRiskGate = false): Promise<void> => {
      if (!branchId) {
        setErrorMsg(t("kiosk.invalidQR"));
        setState("ERROR");
        return;
      }

      const { data: enrollment, error: eErr } = await supabase
        .from("dcu_enrollments")
        .select(
          "id, status, resident_id, residents:resident_id(name_zh, name, photo_storage_path, wandering_risk_level, wandering_risk_notes)",
        )
        .eq("qr_code_uuid", qrCodeUUID)
        .maybeSingle();

      if (eErr || !enrollment) {
        setErrorMsg(t("kiosk.invalidQR"));
        setState("ERROR");
        return;
      }
      if (enrollment.status !== "ACTIVE") {
        setErrorMsg(t("kiosk.enrollmentInactive"));
        setState("ERROR");
        return;
      }

      const today = todayDateStr();
      const { data: todayEvents } = await supabase
        .from("attendance_events")
        .select("id, event_type, event_time")
        .eq("enrollment_id", enrollment.id)
        .gte("event_time", `${today}T00:00:00`)
        .lte("event_time", `${today}T23:59:59`)
        .order("event_time", { ascending: true });

      const events = todayEvents ?? [];
      const hasCheckIn = events.some((e) => e.event_type === "CHECK_IN");
      const hasCheckOut = events.some((e) => e.event_type === "CHECK_OUT");

      if (hasCheckIn && hasCheckOut) {
        setErrorMsg(t("kiosk.duplicateCheckout"));
        setState("ERROR");
        return;
      }

      const nextEventType: "CHECK_IN" | "CHECK_OUT" = hasCheckIn ? "CHECK_OUT" : "CHECK_IN";
      const eventTime = originalEventTime ?? new Date().toISOString();

      // HIGH-risk wandering gate (skip for queued replays — already confirmed at scan time)
      const resForGate = enrollment.residents;
      if (
        nextEventType === "CHECK_OUT" &&
        !skipHighRiskGate &&
        !originalEventTime &&
        resForGate?.wandering_risk_level === "HIGH"
      ) {
        setPendingHighRiskCheckOut({
          enrollmentId: enrollment.id,
          residentName: resForGate.name_zh ?? resForGate.name ?? "—",
          wanderingNotes: resForGate.wandering_risk_notes ?? null,
          photoPath: resForGate.photo_storage_path ?? null,
          eventTime,
          qrCodeUUID,
        });
        return;
      }

      const { data: insertedEvent, error: insErr } = await supabase
        .from("attendance_events")
        .insert({
          enrollment_id: enrollment.id,
          branch_id: branchId,
          event_type: nextEventType,
          event_time: eventTime,
          operator_type: "KIOSK",
          is_manual: false,
          synced_at: originalEventTime ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (insErr || !insertedEvent) {
        setErrorMsg(t("kiosk.invalidQR"));
        setState("ERROR");
        return;
      }

      // Maintain attendance_sessions
      if (nextEventType === "CHECK_IN") {
        await supabase
          .from("attendance_sessions")
          .upsert(
            {
              enrollment_id: enrollment.id,
              branch_id: branchId,
              session_date: today,
              check_in_event_id: insertedEvent.id,
              check_in_at: insertedEvent.event_time,
              status: "PRESENT",
            },
            { onConflict: "enrollment_id,session_date" },
          );
      } else {
        const { data: session } = await supabase
          .from("attendance_sessions")
          .select("id, check_in_at")
          .eq("enrollment_id", enrollment.id)
          .eq("session_date", today)
          .maybeSingle();
        const checkInIso = session?.check_in_at ?? null;
        const durationMinutes = checkInIso
          ? Math.max(
              0,
              Math.round(
                (new Date(insertedEvent.event_time).getTime() -
                  new Date(checkInIso).getTime()) /
                  60000,
              ),
            )
          : null;
        if (session) {
          await supabase
            .from("attendance_sessions")
            .update({
              check_out_event_id: insertedEvent.id,
              check_out_at: insertedEvent.event_time,
              duration_minutes: durationMinutes,
              status: "PRESENT",
            })
            .eq("id", session.id);
        } else {
          await supabase.from("attendance_sessions").insert({
            enrollment_id: enrollment.id,
            branch_id: branchId,
            session_date: today,
            check_out_event_id: insertedEvent.id,
            check_out_at: insertedEvent.event_time,
            status: "PARTIAL",
          });
        }
      }

      void logAction({
        action: nextEventType === "CHECK_IN" ? "DCU_CHECKIN" : "DCU_CHECKOUT",
        entity_type: "attendance_events",
        entity_id: insertedEvent.id,
        branch_id: branchId,
        after_state: {
          enrollment_id: enrollment.id,
          event_type: nextEventType,
          event_time: insertedEvent.event_time,
        },
        metadata: { source: "KIOSK", replayed: !!originalEventTime },
      });

      // TODO: wire attendance-notify Edge Function (WhatsApp Phase 2)

      const resident = enrollment.residents;
      const photoUrl = await getPhotoUrl(resident?.photo_storage_path ?? null);
      setResultDisplay({
        residentNameZh: resident?.name_zh ?? "—",
        residentName: resident?.name ?? "",
        photoUrl,
        time: formatHHmm(insertedEvent.event_time),
      });
      setState(nextEventType === "CHECK_IN" ? "SUCCESS_CHECKIN" : "SUCCESS_CHECKOUT");

      void qc.invalidateQueries({ queryKey: ["attendanceEvents"] });
      void qc.invalidateQueries({ queryKey: ["attendanceSessions"] });
    },
    [branchId, t, logAction, qc, getPhotoUrl],
  );

  const syncOfflineQueue = useCallback(async () => {
    if (!branchId) return;
    setSyncing(true);
    try {
      const queued = await getQueuedScans();
      for (const scan of queued) {
        try {
          await processScan(scan.qr_code_uuid, scan.event_time);
          await removeFromQueue(scan._idbKey);
        } catch {
          // leave in queue, continue
        }
      }
    } finally {
      setSyncing(false);
      await refreshQueueCount();
    }
  }, [branchId, processScan, refreshQueueCount]);

  // Handle each scan from the camera
  const handleScan = useCallback(
    async (decoded: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        const trimmed = decoded.trim();
        if (!branchId) {
          setErrorMsg(t("kiosk.invalidQR"));
          setState("ERROR");
          return;
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await enqueueScan({
            qr_code_uuid: trimmed,
            event_time: new Date().toISOString(),
            branch_id: branchId,
            operator_type: "KIOSK",
          });
          await refreshQueueCount();
          setState("OFFLINE_QUEUED");
          return;
        }
        await processScan(trimmed);
      } finally {
        // small delay so the same QR doesn't double-fire while UI transitions
        window.setTimeout(() => {
          processingRef.current = false;
        }, 500);
      }
    },
    [branchId, processScan, refreshQueueCount, t],
  );

  // Mount/unmount the html5-qrcode scanner only while in STANDBY.
  useEffect(() => {
    if (state !== "STANDBY") {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {
          /* noop */
        });
        scannerRef.current = null;
      }
      return;
    }
    // delay so the target div is mounted
    const id = window.setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          SCANNER_ELEMENT_ID,
          { fps: 10, qrbox: 250, disableFlip: false },
          false,
        );
        scanner.render(
          (decodedText) => {
            void handleScan(decodedText);
          },
          () => {
            /* ignore per-frame decode failures */
          },
        );
        scannerRef.current = scanner;
      } catch {
        /* swallow camera unavailable on SSR/preview */
      }
    }, 50);
    return () => {
      window.clearTimeout(id);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {
          /* noop */
        });
        scannerRef.current = null;
      }
    };
  }, [state, handleScan]);

  // Auto-return to STANDBY for transient states
  useEffect(() => {
    if (stateTimerRef.current) {
      window.clearTimeout(stateTimerRef.current);
      stateTimerRef.current = null;
    }
    let delay = 0;
    if (state === "SUCCESS_CHECKIN" || state === "SUCCESS_CHECKOUT") delay = 3000;
    else if (state === "ERROR") delay = 4000;
    else if (state === "OFFLINE_QUEUED") delay = 2000;
    if (delay > 0) {
      stateTimerRef.current = window.setTimeout(() => {
        setResultDisplay(null);
        setErrorMsg("");
        setState("STANDBY");
      }, delay);
    }
    return () => {
      if (stateTimerRef.current) {
        window.clearTimeout(stateTimerRef.current);
        stateTimerRef.current = null;
      }
    };
  }, [state]);

  return (
    <KioskShell online={online}>
      {/* Top-right queue banner */}
      {queueCount > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30" style={{ width: "min(560px, 92vw)" }}>
          <Banner
            severity="warning"
            title={t("kiosk.offlineQueueCount", { count: queueCount })}
            description={syncing ? t("kiosk.syncing") : undefined}
          />
          <div className="mt-2 flex justify-end">
            <Button size="compact" variant="ghost" onClick={() => void syncOfflineQueue()} disabled={syncing || !online}>
              {syncing ? <Spinner size="sm" /> : t("kiosk.syncNow")}
            </Button>
          </div>
        </div>
      )}

      {/* Floating manual-override trigger */}
      <button
        type="button"
        className="absolute bottom-20 left-6 z-30 rounded-md px-3 py-2 type-button"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          color: "var(--text-link)",
        }}
        onClick={() => setState("MANUAL_OVERRIDE")}
      >
        <Inline gap={2}>
          <UserCog size={16} />
          <span>{t("kiosk.staffOverrideTitle")}</span>
        </Inline>
      </button>

      <div className="w-full h-full flex flex-col items-center justify-center" style={{ maxWidth: 520 }}>
        {state === "STANDBY" && (
          <Stack gap={5} align="center">
            <Heading level={2}>{t("kiosk.title")}</Heading>
            <div
              id={SCANNER_ELEMENT_ID}
              style={{
                width: 320,
                height: 320,
                border: "2px dashed var(--border-default)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                backgroundColor: "var(--bg-subtle)",
              }}
            />
            <Text size="lg" color="secondary">{t("kiosk.standby")}</Text>
            <Text size="sm" color="tertiary">{t("kiosk.notificationStubHint")}</Text>
          </Stack>
        )}

        {(state === "SUCCESS_CHECKIN" || state === "SUCCESS_CHECKOUT") && resultDisplay && (
          <div
            className="w-full p-8 flex flex-col items-center"
            style={{
              backgroundColor: "var(--status-success-bg)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--status-success-border, var(--border-default))",
            }}
          >
            <Stack gap={4} align="center">
              <CheckCircle2 size={80} style={{ color: "var(--status-success-accent)" }} />
              {resultDisplay.photoUrl ? (
                <Avatar src={resultDisplay.photoUrl} name={resultDisplay.residentNameZh} size="lg" />
              ) : (
                <Avatar name={resultDisplay.residentNameZh} size="lg" />
              )}
              <Heading level={1}>{resultDisplay.residentNameZh}</Heading>
              {resultDisplay.residentName && (
                <Text size="lg" color="secondary">{resultDisplay.residentName}</Text>
              )}
              <Heading level={3}>
                {state === "SUCCESS_CHECKIN" ? t("kiosk.checkedIn") : t("kiosk.checkedOut")}
              </Heading>
              <Text size="md" color="secondary">{resultDisplay.time}</Text>
            </Stack>
          </div>
        )}

        {state === "ERROR" && (
          <div
            className="w-full p-8 flex flex-col items-center"
            style={{
              backgroundColor: "var(--status-error-bg)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--status-error-border, var(--border-default))",
            }}
          >
            <Stack gap={3} align="center">
              <XCircle size={80} style={{ color: "var(--status-error-accent)" }} />
              <Heading level={2}>{errorMsg || t("kiosk.invalidQR")}</Heading>
              <Text size="sm" color="secondary">{t("kiosk.invalidQRHint")}</Text>
            </Stack>
          </div>
        )}

        {state === "OFFLINE_QUEUED" && (
          <div
            className="w-full p-8 flex flex-col items-center"
            style={{
              backgroundColor: "var(--bg-subtle)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-default)",
            }}
          >
            <Stack gap={3} align="center">
              <WifiOff size={60} style={{ color: "var(--text-tertiary)" }} />
              <Heading level={2}>{t("kiosk.offline")}</Heading>
              <Text size="md" color="secondary">{t("kiosk.offlineHint")}</Text>
              {queueCount > 0 && (
                <Badge tone="warning">{t("kiosk.offlineQueueCount", { count: queueCount })}</Badge>
              )}
            </Stack>
          </div>
        )}
      </div>

      <ManualOverrideDrawer
        open={state === "MANUAL_OVERRIDE"}
        onClose={() => setState("STANDBY")}
        branchId={branchId}
        onRequestHighRiskCheckOut={(payload) => {
          setPendingHighRiskCheckOut({
            enrollmentId: payload.enrollmentId,
            residentName: payload.residentName,
            wanderingNotes: payload.wanderingNotes,
            photoPath: null,
            eventTime: new Date().toISOString(),
            manual: { residentId: payload.residentId, reason: payload.reason },
          });
          setState("STANDBY");
        }}
        onSubmitted={() => {
          void qc.invalidateQueries({ queryKey: ["attendanceEvents"] });
          void qc.invalidateQueries({ queryKey: ["attendanceSessions"] });
          setState("STANDBY");
        }}
      />

      {pendingHighRiskCheckOut && (
        <ConfirmDialog
          open={true}
          onClose={() => setPendingHighRiskCheckOut(null)}
          onConfirm={() => {
            const p = pendingHighRiskCheckOut;
            setPendingHighRiskCheckOut(null);
            if (p.manual) {
              void performManualCheckOut(p.manual.residentId, p.manual.reason);
            } else if (p.qrCodeUUID) {
              void processScan(p.qrCodeUUID, undefined, true);
            }
          }}
          title={t("wandering.checkOutWarning")}
          summary={`${t("wandering.checkOutConfirm")} ${pendingHighRiskCheckOut.residentName}`}
          consequence={pendingHighRiskCheckOut.wanderingNotes ?? undefined}
          confirmLabel={t("wandering.checkOutProceed")}
          cancelLabel={t("wandering.checkOutCancel")}
        />
      )}
    </KioskShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual override drawer
// ─────────────────────────────────────────────────────────────────────────────

interface ManualOverrideDrawerProps {
  open: boolean;
  onClose: () => void;
  branchId: string | null;
  onSubmitted: () => void;
}

function ManualOverrideDrawer({ open, onClose, branchId, onSubmitted }: ManualOverrideDrawerProps) {
  const { t } = useTranslation();
  const { logAction } = useAuditLog();
  const [search, setSearch] = useState("");
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { residents, isLoading } = useResidents({
    branchId,
    search,
    status: "ADMITTED",
    page: 1,
    pageSize: 10,
  });

  const selectedResident = useMemo(
    () => residents.find((r) => r.id === selectedResidentId) ?? null,
    [residents, selectedResidentId],
  );

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedResidentId(null);
      setEventType("CHECK_IN");
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!branchId || !selectedResident) return;
    if (!reason.trim()) {
      setError(t("kiosk.overrideReasonRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Find ACTIVE enrollment for this resident in this branch
      const { data: enrollment, error: enrErr } = await supabase
        .from("dcu_enrollments")
        .select("id")
        .eq("resident_id", selectedResident.id)
        .eq("branch_id", branchId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (enrErr) throw enrErr;
      if (!enrollment) throw new Error(t("kiosk.enrollmentInactive"));

      const nowIso = new Date().toISOString();
      const today = todayDateStr();
      const { data: inserted, error: insErr } = await supabase
        .from("attendance_events")
        .insert({
          enrollment_id: enrollment.id,
          branch_id: branchId,
          event_type: eventType,
          event_time: nowIso,
          operator_type: "STAFF_MANUAL",
          is_manual: true,
          manual_reason: reason.trim(),
        })
        .select()
        .single();
      if (insErr || !inserted) throw insErr ?? new Error("Insert failed");

      if (eventType === "CHECK_IN") {
        await supabase.from("attendance_sessions").upsert(
          {
            enrollment_id: enrollment.id,
            branch_id: branchId,
            session_date: today,
            check_in_event_id: inserted.id,
            check_in_at: inserted.event_time,
            status: "PRESENT",
            swd_flagged: true,
          },
          { onConflict: "enrollment_id,session_date" },
        );
      } else {
        const { data: session } = await supabase
          .from("attendance_sessions")
          .select("id, check_in_at")
          .eq("enrollment_id", enrollment.id)
          .eq("session_date", today)
          .maybeSingle();
        const dur = session?.check_in_at
          ? Math.max(
              0,
              Math.round(
                (new Date(inserted.event_time).getTime() -
                  new Date(session.check_in_at).getTime()) /
                  60000,
              ),
            )
          : null;
        if (session) {
          await supabase
            .from("attendance_sessions")
            .update({
              check_out_event_id: inserted.id,
              check_out_at: inserted.event_time,
              duration_minutes: dur,
              status: "PRESENT",
              swd_flagged: true,
            })
            .eq("id", session.id);
        } else {
          await supabase.from("attendance_sessions").insert({
            enrollment_id: enrollment.id,
            branch_id: branchId,
            session_date: today,
            check_out_event_id: inserted.id,
            check_out_at: inserted.event_time,
            status: "PARTIAL",
            swd_flagged: true,
          });
        }
      }

      await logAction({
        action: eventType === "CHECK_IN" ? "DCU_CHECKIN" : "DCU_CHECKOUT",
        entity_type: "attendance_events",
        entity_id: inserted.id,
        branch_id: branchId,
        after_state: {
          enrollment_id: enrollment.id,
          event_type: eventType,
          event_time: inserted.event_time,
        },
        metadata: { manual: true, reason: reason.trim() },
      });

      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={t("kiosk.staffOverrideTitle")} width={420}>
      <Stack gap={4}>
        <SearchField
          placeholder={t("kiosk.staffSearch")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {!selectedResident && (
          <Stack gap={2}>
            {isLoading && <Text size="sm" color="secondary"><Spinner size="sm" /></Text>}
            {!isLoading && residents.length === 0 && (
              <Text size="sm" color="tertiary">{t("attendance.noRecords")}</Text>
            )}
            {residents.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedResidentId(r.id)}
                className="text-left rounded-md p-2 hover:bg-[var(--bg-hover-subtle)]"
                style={{ border: "1px solid var(--border-subtle)" }}
              >
                <Inline gap={3} align="center">
                  <Avatar name={r.name_zh ?? r.name} size="sm" />
                  <Stack gap={1}>
                    <Text size="md">{r.name_zh}</Text>
                    <Text size="sm" color="secondary">{r.name}</Text>
                  </Stack>
                </Inline>
              </button>
            ))}
          </Stack>
        )}

        {selectedResident && (
          <Stack gap={4}>
            <Inline gap={3} align="center">
              <Avatar name={selectedResident.name_zh ?? selectedResident.name} size="md" />
              <Stack gap={1}>
                <Text size="md">{selectedResident.name_zh}</Text>
                <Text size="sm" color="secondary">{selectedResident.name}</Text>
              </Stack>
              <Button size="compact" variant="ghost" onClick={() => setSelectedResidentId(null)}>×</Button>
            </Inline>

            <FormField label={t("kiosk.selectEventType")} required>
              <Inline gap={4}>
                <Radio
                  name="evt"
                  label={t("kiosk.overrideCheckIn")}
                  checked={eventType === "CHECK_IN"}
                  onChange={() => setEventType("CHECK_IN")}
                />
                <Radio
                  name="evt"
                  label={t("kiosk.overrideCheckOut")}
                  checked={eventType === "CHECK_OUT"}
                  onChange={() => setEventType("CHECK_OUT")}
                />
              </Inline>
            </FormField>

            <FormField label={t("attendance.overrideReason")} required>
              <TextField
                placeholder={t("kiosk.overrideReasonRequired")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </FormField>

            {error && <Text size="sm" color="primary" style={{ color: "var(--status-error-accent)" }}>{error}</Text>}

            <Inline gap={2}>
              <Button variant="ghost" onClick={onClose} disabled={submitting}>
                {t("actions.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleConfirm()}
                disabled={submitting || !reason.trim()}
              >
                {submitting ? <Spinner size="sm" /> : t("kiosk.confirmOverride")}
              </Button>
            </Inline>
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
