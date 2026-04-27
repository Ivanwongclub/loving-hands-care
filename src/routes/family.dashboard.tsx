import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FamilyShell } from "@/components/shells/FamilyShell";
import { Stack, Heading, Text, Card, Inline, Badge, Spinner } from "@/components/hms";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/family/dashboard")({
  component: FamilyDashboardPage,
});

function FamilyDashboardPage() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: "/family/login", replace: true });
    }
  }, [session, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen w-full grid place-items-center" style={{ backgroundColor: "var(--bg-page)" }}>
        <Spinner size="lg" />
      </div>
    );
  }
  if (!session) return null;
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
              <Text size="sm" color="secondary">Room 305</Text>
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
