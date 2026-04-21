import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  Stack, Heading, Text, FormField, TextField, PasswordField,
  Button, Alert,
} from "@/components/hms";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { signInWithPassword, session } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If session restored, bounce to dashboard
  useEffect(() => {
    if (session) void navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await signInWithPassword(email, password);
    setLoading(false);
    if (err) {
      setError(t("auth.invalidCredentials"));
      return;
    }
    void navigate({ to: "/dashboard" });
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
          <Stack gap={2} align="start">
            <div className="font-extrabold tracking-tight" style={{ fontSize: 28, color: "var(--color-onyx-900)" }}>HMS</div>
            <Heading level={1}>Helping Hand HMS</Heading>
            <Text color="secondary">{t("app.name")}</Text>
          </Stack>

          {error && <Alert severity="error" title={error} />}

          <form onSubmit={submit}>
            <Stack gap={4}>
              <FormField label={t("auth.email")} required>
                <TextField type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@helpinghand.org.hk" required />
              </FormField>
              <FormField label={t("auth.password")} required>
                <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} required />
              </FormField>
              <Button type="submit" fullWidth loading={loading}>{t("actions.signIn")} · 登入</Button>
              <button type="button" className="type-body-sm text-center hover:underline" style={{ color: "var(--text-link)" }}>
                {t("auth.forgotPassword")}
              </button>
            </Stack>
          </form>
        </Stack>
      </div>
    </div>
  );
}
