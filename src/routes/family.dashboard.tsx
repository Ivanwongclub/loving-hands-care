import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FamilyShell } from "@/components/shells/FamilyShell";
import { Stack, Heading, Text, Card, Inline, Badge } from "@/components/hms";

export const Route = createFileRoute("/family/dashboard")({
  component: FamilyDashboardPage,
});

function FamilyDashboardPage() {
  const { t } = useTranslation();
  return (
    <FamilyShell>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>歡迎 · Welcome</Heading>
          <Text color="secondary">{t("app.familyPortal")}</Text>
        </Stack>
        <Card>
          <Inline justify="between">
            <Stack gap={1}>
              <Text className="font-semibold">陳大文 · Chan Tai Man</Text>
              <Text size="sm" color="secondary">Room 305 · 中央院舍</Text>
            </Stack>
            <Badge tone="success" dot>Stable · 穩定</Badge>
          </Inline>
        </Card>
        <Card header={<Text className="type-h3">{t("common.comingSoon")}</Text>}>
          <Text color="secondary">Visit scheduling, photo updates, and care notes will appear here.</Text>
        </Card>
      </Stack>
    </FamilyShell>
  );
}
