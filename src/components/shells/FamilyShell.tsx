import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Languages } from "lucide-react";
import { Inline } from "@/components/hms";
import { signOut } from "@/lib/auth";

export function FamilyShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "var(--bg-page)" }}>
      <header
        className="flex items-center justify-between"
        style={{
          height: "var(--topbar-height)", paddingInline: 24,
          backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Inline gap={3}>
          <span className="font-extrabold" style={{ fontSize: 20, color: "var(--color-onyx-900)" }}>HMS</span>
          <span className="type-body-md" style={{ color: "var(--text-secondary)" }}>{t("app.familyPortal")}</span>
        </Inline>
        <Inline gap={2}>
          <button onClick={() => void i18n.changeLanguage(i18n.language === "en" ? "zh-HK" : "en")} className="type-body-sm font-semibold flex items-center gap-1 px-3 py-1.5 rounded hover:bg-[var(--bg-hover-subtle)]">
            <Languages size={14} />{i18n.language === "en" ? "EN" : "中"}
          </button>
          <button onClick={() => { signOut(); navigate({ to: "/family/login" }); }} className="p-2 rounded hover:bg-[var(--bg-hover-subtle)]" aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </Inline>
      </header>
      <main className="mx-auto" style={{ maxWidth: 720, padding: "24px" }}>{children}</main>
    </div>
  );
}
