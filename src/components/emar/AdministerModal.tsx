import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Html5QrcodeScanner } from "html5-qrcode";
import { CheckCircle2, ChevronLeft, Shield, XCircle } from "lucide-react";
import {
  Modal, Stack, Inline, Text, Heading, Button, Surface, Alert, Spinner, Divider, FormField, TextArea, Avatar,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { EMARRow } from "@/hooks/useEMARRecords";
import type { useAuditLog } from "@/hooks/useAuditLog";

type AdminStep = "BARCODE" | "PIN" | "CONFIRM" | "SUBMITTING" | "SUCCESS";

interface AdministerModalProps {
  open: boolean;
  onClose: () => void;
  record: EMARRow | null;
  residentNameZh: string;
  residentName: string;
  branchId: string;
  staffId: string;
  date: string;
  residentId: string;
  residentPhotoPath: string | null;
  residentPhotoDeclined: boolean;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

const SCANNER_ELEMENT_ID = "emar-barcode-reader";

function nowTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdministerModal({
  open, onClose, record, residentNameZh, residentName, branchId, staffId, date, residentId,
  residentPhotoPath, residentPhotoDeclined, logAction,
}: AdministerModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [step, setStep] = useState<AdminStep>("BARCODE");
  const [currentPin, setCurrentPin] = useState("");
  const [pinLocked, setPinLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [barcodeVerified, setBarcodeVerified] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState<string | null>(null);
  const [supervisorOverride, setSupervisorOverride] = useState(false);
  const [prnOutcomeNotes, setPrnOutcomeNotes] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open || !record) return;
    setStep(record.order?.barcode ? "BARCODE" : "PIN");
    setCurrentPin("");
    setPinLocked(false);
    setVerifying(false);
    setVerifyError(null);
    setBarcodeVerified(false);
    setBarcodeScanned(null);
    setSupervisorOverride(false);
    setPrnOutcomeNotes("");
    setScanError(null);
  }, [open, record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount/unmount scanner for BARCODE step
  useEffect(() => {
    if (!open || step !== "BARCODE" || !record?.order?.barcode) return;
    let cancelled = false;
    const expected = record.order.barcode;

    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        const scanner = new Html5QrcodeScanner(
          SCANNER_ELEMENT_ID,
          { fps: 10, qrbox: 200 },
          false,
        );
        scannerRef.current = scanner;
        scanner.render(
          (decodedText: string) => {
            if (decodedText === expected) {
              setBarcodeScanned(decodedText);
              setBarcodeVerified(true);
              setScanError(null);
              toast.success(t("emar.barcodeMatch"));
              try { void scanner.clear(); } catch { /* noop */ }
              scannerRef.current = null;
              setStep("PIN");
            } else {
              setScanError(t("emar.barcodeMismatch"));
            }
          },
          () => { /* ignore scan errors */ },
        );
      } catch (e) {
        setScanError(e instanceof Error ? e.message : "Scanner error");
      }
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (scannerRef.current) {
        try { void scannerRef.current.clear(); } catch { /* noop */ }
        scannerRef.current = null;
      }
    };
  }, [open, step, record?.order?.barcode, t]);

  const handleClose = () => {
    if (scannerRef.current) {
      try { void scannerRef.current.clear(); } catch { /* noop */ }
      scannerRef.current = null;
    }
    onClose();
  };

  const handleSkipBarcode = () => {
    if (scannerRef.current) {
      try { void scannerRef.current.clear(); } catch { /* noop */ }
      scannerRef.current = null;
    }
    setBarcodeVerified(false);
    setBarcodeScanned(null);
    setScanError(null);
    setTimeout(() => setStep("PIN"), 1500);
  };

  const verifyPIN = async (pin: string) => {
    if (!record) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const { data, error } = await supabase.functions.invoke("emar-verify-pin", {
        body: { staff_id: staffId, pin, emar_record_id: record.id },
      });
      if (error) throw error;
      const result = data as { success: boolean; locked: boolean; message?: string };
      if (result.locked) {
        setPinLocked(true);
        setVerifyError(t("emar.pinLocked"));
        setCurrentPin("");
        return;
      }
      if (result.success) {
        setStep("CONFIRM");
      } else {
        setVerifyError(result.message ?? t("emar.pinIncorrect"));
        setCurrentPin("");
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Verification failed");
      setCurrentPin("");
    } finally {
      setVerifying(false);
    }
  };

  const onPinDigit = (d: string) => {
    if (verifying || pinLocked) return;
    setVerifyError(null);
    setCurrentPin((p) => {
      if (p.length >= 4) return p;
      const next = p + d;
      if (next.length === 4) {
        setTimeout(() => void verifyPIN(next), 50);
      }
      return next;
    });
  };

  const onPinBackspace = () => {
    if (verifying || pinLocked) return;
    setCurrentPin((p) => p.slice(0, -1));
  };

  const onPinClear = () => {
    if (verifying || pinLocked) return;
    setCurrentPin("");
    setVerifyError(null);
  };

  const handleFinalise = async () => {
    if (!record) return;
    setStep("SUBMITTING");
    try {
      const { data: before } = await supabase
        .from("emar_records").select("*").eq("id", record.id).single();

      const { data: after, error } = await supabase
        .from("emar_records")
        .update({
          status: "ADMINISTERED",
          administered_at: new Date().toISOString(),
          administered_by: staffId,
          barcode_scanned: barcodeScanned ?? null,
          barcode_verified: barcodeVerified,
          shift_pin_verified: true,
          supervisor_override: supervisorOverride,
          prn_outcome_notes: prnOutcomeNotes || null,
        })
        .eq("id", record.id)
        .select()
        .single();
      if (error) throw error;

      await logAction({
        action: "EMAR_ADMINISTERED",
        entity_type: "emar_records",
        entity_id: record.id,
        branch_id: branchId,
        before_state: before ?? null,
        after_state: after ?? null,
        metadata: {
          barcode_verified: barcodeVerified,
          supervisor_override: supervisorOverride,
          resident_id: residentId,
        },
      });

      void qc.invalidateQueries({ queryKey: ["emarRecords", residentId, date] });
      void qc.invalidateQueries({ queryKey: ["emarRecords", residentId] });
      setStep("SUCCESS");
      setTimeout(() => handleClose(), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record administration");
      setStep("CONFIRM");
    }
  };

  if (!record) return null;

  const drugLabel = record.order?.drug_name_zh ?? record.order?.drug_name ?? "—";
  const drugLatin = record.order?.drug_name ?? "";
  const dose = record.order?.dose ?? "—";
  const isPRN = record.order?.is_prn ?? false;

  let title = t("emar.adminConfirmTitle");
  if (step === "BARCODE") title = t("emar.step1Barcode");
  else if (step === "PIN") title = t("emar.step2PIN");
  else if (step === "CONFIRM") title = t("emar.step3Confirm");

  return (
    <Modal open={open} onClose={handleClose} title={title} size="lg">
      <ResidentPhotoIdBanner
        residentNameZh={residentNameZh}
        residentName={residentName}
        residentId={residentId}
        branchId={branchId}
        photoPath={residentPhotoPath}
        photoDeclined={residentPhotoDeclined}
      />
      {step === "SUCCESS" ? (
        <div
          style={{
            backgroundColor: "var(--status-success-bg)",
            borderRadius: "var(--radius-md)",
            padding: 48,
            textAlign: "center",
          }}
        >
          <Stack gap={3} align="center">
            <CheckCircle2 size={80} style={{ color: "var(--status-success-accent)" }} />
            <Heading level={3}>{t("emar.adminSuccess")}</Heading>
          </Stack>
        </div>
      ) : step === "SUBMITTING" ? (
        <Stack gap={3} align="center" className="py-12">
          <Spinner size="md" />
          <Text>{t("emar.administering")}</Text>
        </Stack>
      ) : step === "BARCODE" ? (
        <Stack gap={3}>
          <Surface padding="md">
            <Stack gap={1}>
              <Text size="lg" className="font-semibold">{drugLabel}</Text>
              {drugLatin && drugLatin !== drugLabel && (
                <Text size="sm" color="secondary">{drugLatin}</Text>
              )}
              <Text size="sm" color="tertiary">{dose}</Text>
            </Stack>
          </Surface>
          {scanError && <Alert severity="error" description={scanError} />}
          <div id={SCANNER_ELEMENT_ID} style={{ width: "100%" }} />
          <Inline justify="end">
            <Button variant="ghost" onClick={handleSkipBarcode}>
              {t("emar.barcodeSkip")}
            </Button>
          </Inline>
          {!barcodeVerified && barcodeScanned === null && (
            <Alert severity="warning" description={t("emar.barcodeHint")} />
          )}
        </Stack>
      ) : step === "PIN" ? (
        <Stack gap={4}>
          <Surface padding="md">
            <Stack gap={1}>
              <Text size="lg" className="font-semibold">{drugLabel}</Text>
              <Text size="sm" color="tertiary">{dose}</Text>
            </Stack>
          </Surface>

          {pinLocked ? (
            <Stack gap={3}>
              <Alert severity="error" description={t("emar.pinLocked")} />
              <Button variant="soft" onClick={() => setSupervisorOverride(true)}>
                {t("emar.supervisorOverride")}
              </Button>
              {supervisorOverride && (
                <Alert severity="info" description={t("emar.supervisorOverrideLabel")} />
              )}
            </Stack>
          ) : (
            <Stack gap={4} align="center">
              <Text size="sm" color="secondary">{t("emar.pinHint")}</Text>
              {/* PIN circles */}
              <Inline gap={3} justify="center">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      backgroundColor:
                        i < currentPin.length ? "var(--text-primary)" : "transparent",
                      border: "2px solid var(--border-default)",
                    }}
                  />
                ))}
              </Inline>

              {verifyError && <Alert severity="error" description={verifyError} />}

              <div style={{ position: "relative" }}>
                {verifying && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      zIndex: 5,
                      backgroundColor: "color-mix(in oklab, var(--bg-surface) 70%, transparent)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <Spinner size="md" />
                  </div>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 64px)",
                    gap: 12,
                  }}
                >
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                    <NumpadButton key={d} onClick={() => onPinDigit(d)} disabled={verifying}>
                      {d}
                    </NumpadButton>
                  ))}
                  <NumpadButton onClick={onPinBackspace} disabled={verifying} aria-label="Backspace">
                    <ChevronLeft size={20} />
                  </NumpadButton>
                  <NumpadButton onClick={() => onPinDigit("0")} disabled={verifying}>
                    0
                  </NumpadButton>
                  <button
                    type="button"
                    onClick={onPinClear}
                    disabled={verifying}
                    style={{
                      width: 64,
                      height: 64,
                      background: "transparent",
                      border: "none",
                      color: "var(--text-tertiary)",
                      cursor: verifying ? "default" : "pointer",
                      fontSize: 12,
                    }}
                  >
                    {t("emar.pinClear")}
                  </button>
                </div>
              </div>
            </Stack>
          )}
        </Stack>
      ) : (
        // CONFIRM
        <Stack gap={4}>
          <Surface padding="md">
            <Stack gap={2}>
              <SummaryRow label={t("emar.adminConfirmResident")} value={residentNameZh || residentName} />
              <SummaryRow label={t("emar.adminConfirmDrug")} value={drugLabel} />
              <SummaryRow label={t("emar.adminConfirmDose")} value={dose} />
              <SummaryRow label={t("emar.adminConfirmTime")} value={nowTime()} />
              <Divider />
              <Inline gap={2} align="center">
                {barcodeVerified ? (
                  <CheckCircle2 size={18} style={{ color: "var(--accent-success)" }} />
                ) : (
                  <XCircle size={18} style={{ color: "var(--accent-warning)" }} />
                )}
                <Text size="sm">
                  {t("emar.barcodeVerified")}: {barcodeVerified ? "✓" : "—"}
                </Text>
              </Inline>
              <Inline gap={2} align="center">
                <Shield size={18} style={{ color: "var(--accent-success)" }} />
                <Text size="sm">{t("emar.pinVerified")}</Text>
              </Inline>
              {supervisorOverride && (
                <Alert severity="warning" description={t("emar.supervisorOverrideLabel")} />
              )}
            </Stack>
          </Surface>

          {isPRN && (
            <FormField label={t("emar.prnOutcomeLabel")}>
              <TextArea
                value={prnOutcomeNotes}
                onChange={(e) => setPrnOutcomeNotes(e.target.value)}
                rows={3}
              />
            </FormField>
          )}

          <Button variant="primary" onClick={handleFinalise} className="w-full">
            {t("emar.adminFinalise")}
          </Button>
        </Stack>
      )}
    </Modal>
  );
}

function ResidentPhotoIdBanner({
  residentNameZh,
  residentName,
  residentId: _residentId,
  branchId: _branchId,
  photoPath,
  photoDeclined,
}: {
  residentNameZh: string;
  residentName: string;
  residentId: string;
  branchId: string;
  photoPath: string | null;
  photoDeclined: boolean;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoPath || photoDeclined) return;
    supabase.storage
      .from("resident-photos")
      .createSignedUrl(photoPath, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
      });
  }, [photoPath, photoDeclined]);

  const initials = (residentNameZh || residentName || "?").slice(0, 2);

  return (
    <Surface
      padding="sm"
      style={{
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--spacing-4)",
        borderLeft: "3px solid var(--color-warning)",
        background: "var(--color-warning-subtle)",
      }}
    >
      <Inline gap={3} align="center">
        {signedUrl ? (
          <img
            src={signedUrl}
            alt={residentNameZh}
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
              border: "2px solid var(--color-warning)",
            }}
          />
        ) : (
          <Avatar size="lg" name={initials} />
        )}
        <Stack gap={1} style={{ flex: 1 }}>
          <Text size="lg" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {residentNameZh}
          </Text>
          <Text size="sm" color="secondary">{residentName}</Text>
          <Text size="sm" style={{ color: "var(--status-warning-text)", fontWeight: 500 }}>
            ⚠ 請確認院友身份後給藥
          </Text>
        </Stack>
      </Inline>
    </Surface>
  );
}

function NumpadButton({
  children, onClick, disabled, ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-surface)",
        color: "var(--text-primary)",
        fontSize: 22,
        fontWeight: 500,
        cursor: disabled ? "default" : "pointer",
        display: "grid",
        placeItems: "center",
        transition: "background-color var(--duration-fast) ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = "var(--bg-hover-subtle)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--bg-surface)";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Inline justify="between" align="center" className="w-full">
      <Text size="sm" color="tertiary">{label}</Text>
      <Text size="sm" className="font-medium">{value}</Text>
    </Inline>
  );
}
