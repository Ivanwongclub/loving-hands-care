import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import {
  Modal, Stack, Inline, Text, Button, Alert, Spinner,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import type { StaffRow } from "@/hooks/useStaff";

interface SetPINModalProps {
  open: boolean;
  onClose: () => void;
  staffMember: StaffRow | null;
}

type Step = "FIRST" | "CONFIRM" | "SUBMITTING";

export function SetPINModal({ open, onClose, staffMember }: SetPINModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();
  const { staff: currentStaff } = useCurrentStaff();

  const [step, setStep] = useState<Step>("FIRST");
  const [firstPin, setFirstPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("FIRST");
      setFirstPin("");
      setConfirmPin("");
      setErrMsg(null);
    }
  }, [open]);

  const currentValue = step === "FIRST" ? firstPin : confirmPin;
  const setCurrentValue = (v: string) => {
    if (step === "FIRST") setFirstPin(v);
    else setConfirmPin(v);
  };

  const submit = async (finalPin: string) => {
    if (!staffMember) return;
    setStep("SUBMITTING");
    setErrMsg(null);
    try {
      const { error } = await supabase.functions.invoke("staff-set-pin", {
        body: { staff_id: staffMember.id, pin: finalPin },
      });
      if (error) throw error;

      await logAction({
        action: "STAFF_PIN_SET",
        entity_type: "staff",
        entity_id: staffMember.id,
        metadata: {
          staff_id: staffMember.id,
          set_by: currentStaff?.id ?? null,
        },
      });

      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t("staff.pinSetSuccess"));
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      // Friendlier hint when the edge function isn't deployed yet
      if (/not found|404|FunctionNotFound/i.test(msg)) {
        setErrMsg(t("staff.pinFunctionMissing"));
      } else {
        setErrMsg(msg);
      }
      setStep("CONFIRM");
    }
  };

  const onDigit = (d: string) => {
    if (step === "SUBMITTING") return;
    setErrMsg(null);
    const next = (currentValue + d).slice(0, 4);
    setCurrentValue(next);
    if (next.length === 4) {
      if (step === "FIRST") {
        setTimeout(() => setStep("CONFIRM"), 150);
      } else {
        if (next === firstPin) {
          setTimeout(() => void submit(next), 50);
        } else {
          setErrMsg(t("staff.pinMismatch"));
          setTimeout(() => {
            setFirstPin("");
            setConfirmPin("");
            setStep("FIRST");
          }, 800);
        }
      }
    }
  };

  const onBackspace = () => {
    if (step === "SUBMITTING") return;
    setCurrentValue(currentValue.slice(0, -1));
  };

  if (!staffMember) return null;

  const headerLabel = step === "FIRST"
    ? t("staff.setPinTitle")
    : step === "CONFIRM" ? t("staff.confirmPin") : t("staff.setPinConfirm");

  return (
    <Modal open={open} onClose={onClose} title={headerLabel} size="md">
      {step === "SUBMITTING" ? (
        <Stack gap={3} align="center" className="py-12">
          <Spinner size="md" />
          <Text>{t("common.loading")}</Text>
        </Stack>
      ) : (
        <Stack gap={4}>
          <Text size="sm" color="secondary">{t("staff.setPinHint")}</Text>
          <Text size="sm" className="font-medium">
            {staffMember.name_zh || staffMember.name}
          </Text>

          <Inline gap={3} justify="center">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  backgroundColor: i < currentValue.length ? "var(--text-primary)" : "transparent",
                  border: "2px solid var(--border-default)",
                }}
              />
            ))}
          </Inline>

          {errMsg && <Alert severity="error" description={errMsg} />}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 64px)", gap: 12, justifyContent: "center" }}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <NumpadButton key={d} onClick={() => onDigit(d)}>{d}</NumpadButton>
            ))}
            <NumpadButton onClick={onBackspace} aria-label="Backspace">
              <ChevronLeft size={20} />
            </NumpadButton>
            <NumpadButton onClick={() => onDigit("0")}>0</NumpadButton>
            <button
              type="button"
              onClick={() => { setFirstPin(""); setConfirmPin(""); setStep("FIRST"); }}
              style={{
                width: 64, height: 64, background: "transparent", border: "none",
                color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12,
              }}
            >
              {t("actions.reset")}
            </button>
          </div>

          <Inline justify="end">
            <Button variant="soft" onClick={onClose}>{t("actions.cancel")}</Button>
          </Inline>
        </Stack>
      )}
    </Modal>
  );
}

function NumpadButton({
  children, onClick, ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 64, height: 64, borderRadius: "50%",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-surface)",
        color: "var(--text-primary)",
        fontSize: 22, fontWeight: 500, cursor: "pointer",
        display: "grid", placeItems: "center",
        transition: "background-color var(--duration-fast) ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover-subtle)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-surface)"; }}
      {...rest}
    >
      {children}
    </button>
  );
}
