import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Stack, Heading, Text, PINField, Button, Alert, Spinner } from "@/components/hms";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";

export const Route = createFileRoute("/pin-setup")({
  component: PINSetupPage,
});

function PINSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { staff, isLoading } = useCurrentStaff();
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!isLoading && staff?.pin_hash) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [staff, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full grid place-items-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <Spinner size="lg" />
      </div>
    );
  }
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const mismatch = pin.length === 4 && confirm.length === 4 && pin !== confirm;

  return (
    <div className="min-h-screen w-full grid place-items-center px-4" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="w-full" style={{ maxWidth: 480, backgroundColor: "var(--bg-surface)", padding: 40, borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-elevated)" }}>
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>{t("auth.pinSetTitle")}</Heading>
            <Text color="secondary">{t("auth.pinSetHelp")}</Text>
          </Stack>

          {done && <Alert severity="success" title="PIN set successfully · 已成功設定" />}

          <Stack gap={5}>
            <Stack gap={2} align="center">
              <Text size="sm" className="font-semibold">{t("auth.pinNew")}</Text>
              <PINField value={pin} onChange={setPin} />
            </Stack>
            <Stack gap={2} align="center">
              <Text size="sm" className="font-semibold">{t("auth.pinConfirm")}</Text>
              <PINField value={confirm} onChange={setConfirm} state={mismatch ? "error" : "default"} />
              {mismatch && <Text size="caption" color="destructive">{t("auth.pinMismatch")}</Text>}
            </Stack>
          </Stack>

          <Button fullWidth disabled={pin.length !== 4 || pin !== confirm} onClick={() => setDone(true)}>
            {t("actions.confirm")}
          </Button>
        </Stack>
      </div>
    </div>
  );
}
