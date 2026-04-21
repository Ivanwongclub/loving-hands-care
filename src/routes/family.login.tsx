import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Stack, Heading, Text, FormField, TextField, Button, Alert } from "@/components/hms";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/family/login")({
  component: FamilyLoginPage,
});

function FamilyLoginPage() {
  const { t, i18n } = useTranslation();
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const redirectTo = `${window.location.origin}/family/dashboard`;
    const { error: err } = await signInWithMagicLink(email, redirectTo);
    setLoading(false);
    if (err) { setError(err); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen w-full grid place-items-center px-4 relative" style={{ backgroundColor: "var(--bg-page)" }}>
      <button
        onClick={() => void i18n.changeLanguage(i18n.language === "en" ? "zh-HK" : "en")}
        className="absolute top-4 right-4 type-body-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-[var(--bg-hover-subtle)]"
        style={{ color: "var(--text-secondary)" }}
      >
        <Languages size={14} /> {i18n.language === "en" ? "EN" : "中"}
      </button>

      <div
        className="w-full"
        style={{
          maxWidth: 420, backgroundColor: "var(--bg-surface)",
          boxShadow: "var(--shadow-elevated)", padding: 40,
          borderRadius: "var(--radius-lg)",
        }}
      >
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>{t("app.familyPortal")}</Heading>
            <Text color="secondary">{t("auth.familyPortalHelp")}</Text>
          </Stack>

          {sent && <Alert severity="success" title={t("auth.magicLinkSent")} />}
          {error && <Alert severity="error" title={error} />}

          <form onSubmit={submit}>
            <Stack gap={4}>
              <FormField label={t("auth.email")} required>
                <TextField type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </FormField>
              <Button type="submit" fullWidth loading={loading}>{t("auth.magicLinkSend")}</Button>
            </Stack>
          </form>
        </Stack>
      </div>
    </div>
  );
}
