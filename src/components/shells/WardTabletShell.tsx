import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Languages } from "lucide-react";
import { Avatar, Badge, Inline } from "@/components/hms";
import { signOut } from "@/lib/auth";

export function WardTabletShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
          <span className="type-body-md" style={{ color: "var(--text-secondary)" }}>Ward 3A · {t("app.name")}</span>
        </Inline>
        <div className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("common.morningShift")}
        </div>
        <Inline gap={3}>
          <Badge tone="error" emphasis="strong">3 Critical</Badge>
          <button onClick={toggleLang} className="type-body-sm font-semibold flex items-center gap-1 px-3 py-2 rounded hover:bg-[var(--bg-hover-subtle)]" style={{ minHeight: 44 }}>
            <Languages size={16} />{i18n.language === "en" ? "EN" : "中"}
          </button>
          <Avatar name="Wong KM" />
          <button onClick={() => { signOut(); navigate({ to: "/login" }); }} className="p-2 rounded hover:bg-[var(--bg-hover-subtle)]" style={{ minHeight: 44, minWidth: 44 }} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </Inline>
      </header>
      <main style={{ padding: `var(--space-5) var(--page-gutter-tablet)` }}>{children}</main>
    </div>
  );
}
