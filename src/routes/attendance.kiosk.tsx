import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { KioskShell } from "@/components/shells/KioskShell";
import { Stack, Heading, Text, BarcodeInputSurface } from "@/components/hms";

export const Route = createFileRoute("/attendance/kiosk")({
  component: KioskPage,
});

function KioskPage() {
  const { t } = useTranslation();
  return (
    <KioskShell>
      <Stack gap={6} align="center">
        <Stack gap={2} align="center">
          <Heading level={1}>{t("nav.attendance")}</Heading>
          <Text color="secondary">請掃描你的員工卡 · Scan your staff card</Text>
        </Stack>
        <div className="w-full">
          <BarcodeInputSurface status="idle" idleHint="等待掃描中… · Waiting for scan" />
        </div>
      </Stack>
    </KioskShell>
  );
}
