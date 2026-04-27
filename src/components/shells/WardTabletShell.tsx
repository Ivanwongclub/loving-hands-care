import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Languages } from "lucide-react";
import { Avatar, Badge, Inline } from "@/components/hms";
import { useAuth } from "@/lib/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import { useAlerts } from "@/hooks/useAlerts";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";

export function WardTabletShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { branches } = useBranches();
  const branchId = branches[0]?.id ?? null;
  const branchLabel = branches[0]?.name_zh ?? branches[0]?.name ?? "—";
  const { alerts } = useAlerts({ branchId });
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL" && (a.status === "OPEN" || a.status === "ACKNOWLEDGED")).length;
  const { staff } = useCurrentStaff();
  const displayName = staff?.name_zh ?? staff?.name ?? "—";
  const toggleLang = () => void i18n.changeLanguage(i18n.language === "en" ? "zh-HK" : "en");

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "var(--bg-page)", fontSize: 15 }}>
      <header
        className="flex items-center justify-between"
        style={{
          height: "var(--topbar-height)",
          paddingInline: "var(--page-gutter-tablet)",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Inline gap={4}>
          <span className="font-extrabold" style={{ fontSize: 20, color: "var(--color-onyx-900)" }}>HMS</span>
          <span className="type-body-md" style={{ color: "var(--text-secondary)" }}>{branchLabel} · {t("app.name")}</span>
        </Inline>
        <div className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("common.morningShift")}
        </div>
        <Inline gap={3}>
          {criticalCount > 0 && <Badge tone="error" emphasis="strong">{criticalCount} Critical</Badge>}
          <button onClick={toggleLang} className="type-body-sm font-semibold flex items-center gap-1 px-3 py-2 rounded hover:bg-[var(--bg-hover-subtle)]" style={{ minHeight: 44 }}>
            <Languages size={16} />{i18n.language === "en" ? "EN" : "中"}
          </button>
          <Avatar name={displayName} size="sm" />
          <button onClick={async () => { await signOut(); void navigate({ to: "/login" }); }} className="p-2 rounded hover:bg-[var(--bg-hover-subtle)]" style={{ minHeight: 44, minWidth: 44 }} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </Inline>
      </header>
      <main className="[&_button]:min-h-11 [&_a]:min-h-11 [&_input]:min-h-11" style={{ padding: `var(--space-5) var(--page-gutter-tablet)`, fontSize: 15 }}>{children}</main>
    </div>
  );
}
