import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Users, ClipboardCheck, ListTodo, Activity, Pill,
  AlertTriangle, BellRing, ClipboardList, UserCog, FileBarChart2, ScrollText,
  Upload, Settings, LogOut, Bell, Languages, ChevronDown, UserPlus, ExternalLink,
} from "lucide-react";
import { Avatar, ContextSwitcher, Inline, Stack, Text } from "@/components/hms";
import { useAuth } from "@/lib/AuthContext";

interface NavItem { to: string; labelKey: string; icon: ReactNode; external?: boolean }
interface NavSection { titleKey: string; items: NavItem[] }

const sections: NavSection[] = [
  {
    titleKey: "nav.operations",
    items: [
      { to: "/dashboard", labelKey: "nav.dashboard", icon: <LayoutDashboard size={16} /> },
      { to: "/residents", labelKey: "nav.residents", icon: <Users size={16} /> },
      { to: "/attendance/register", labelKey: "nav.attendanceRegister", icon: <ClipboardCheck size={16} /> },
      { to: "/attendance/enrollments", labelKey: "nav.enrollmentMgmt", icon: <UserPlus size={16} /> },
      { to: "/attendance/kiosk", labelKey: "nav.dcuKiosk", icon: <ExternalLink size={16} />, external: true },
      { to: "/tasks", labelKey: "nav.careTasks", icon: <ListTodo size={16} /> },
      { to: "/vitals", labelKey: "nav.vitals", icon: <Activity size={16} /> },
      { to: "/emar", labelKey: "nav.emar", icon: <Pill size={16} /> },
      { to: "/incidents", labelKey: "nav.incidents", icon: <AlertTriangle size={16} /> },
      { to: "/alerts", labelKey: "nav.alerts", icon: <BellRing size={16} /> },
    ],
  },
  {
    titleKey: "nav.management",
    items: [
      { to: "/care-plans", labelKey: "nav.carePlans", icon: <ClipboardList size={16} /> },
      { to: "/staff", labelKey: "nav.staff", icon: <UserCog size={16} /> },
      { to: "/reports", labelKey: "nav.reports", icon: <FileBarChart2 size={16} /> },
      { to: "/audit", labelKey: "nav.audit", icon: <ScrollText size={16} /> },
    ],
  },
  {
    titleKey: "nav.system",
    items: [
      { to: "/import", labelKey: "nav.import", icon: <Upload size={16} /> },
      { to: "/settings", labelKey: "nav.settings", icon: <Settings size={16} /> },
    ],
  },
];

interface AdminDesktopShellProps {
  pageTitle?: ReactNode;
  children: ReactNode;
}

export function AdminDesktopShell({ pageTitle, children }: AdminDesktopShellProps) {
  const { t, i18n } = useTranslation();
  const loc = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const toggleLang = () => {
    const next = i18n.language === "en" ? "zh-HK" : "en";
    void i18n.changeLanguage(next);
  };

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 h-full flex flex-col"
        style={{
          width: "var(--sidebar-width)",
          backgroundColor: "var(--color-neutral-25)",
          boxShadow: "1px 0 0 var(--border-subtle)",
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 18px 16px" }}>
          <div className="font-extrabold tracking-tight" style={{ fontSize: 22, color: "var(--color-onyx-900)" }}>HMS</div>
          <div className="type-caption" style={{ color: "var(--text-secondary)" }}>{t("app.name")}</div>
        </div>

        {/* Branch context */}
        <div style={{ padding: "0 14px 12px" }}>
          <ContextSwitcher label={t("common.branch")} current="Central Branch · 中央院舍" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-auto" style={{ padding: "4px 10px 16px" }}>
          {sections.map((sec) => (
            <div key={sec.titleKey} className="mb-4">
              <div className="type-label px-3 py-2" style={{ color: "var(--text-tertiary)" }}>{t(sec.titleKey)}</div>
              <ul className="flex flex-col gap-0.5">
                {sec.items.map((it) => {
                  const active = !it.external && (loc.pathname === it.to || loc.pathname.startsWith(it.to + "/"));
                  const sharedClass = "flex items-center gap-2.5 px-3 transition-colors w-full text-left";
                  const sharedStyle = {
                    height: 40,
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: active ? "var(--bg-selected)" : "transparent",
                    color: "var(--text-primary)",
                    transitionDuration: "var(--duration-normal)",
                  } as const;
                  const onEnter = (e: React.MouseEvent<HTMLElement>) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover-subtle)"; };
                  const onLeave = (e: React.MouseEvent<HTMLElement>) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; };
                  const inner = (
                    <>
                      <span style={{ color: active ? "var(--color-iris-500)" : "var(--text-secondary)" }}>{it.icon}</span>
                      <span className="type-body-md font-medium">{t(it.labelKey)}</span>
                    </>
                  );
                  return (
                    <li key={it.to}>
                      {it.external ? (
                        <button
                          type="button"
                          onClick={() => window.open(it.to, "_blank")}
                          className={sharedClass}
                          style={sharedStyle}
                          onMouseEnter={onEnter}
                          onMouseLeave={onLeave}
                        >
                          {inner}
                        </button>
                      ) : (
                        <Link
                          to={it.to}
                          className={sharedClass}
                          style={sharedStyle}
                          onMouseEnter={onEnter}
                          onMouseLeave={onLeave}
                        >
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User chip */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border-subtle)" }}>
          <Inline justify="between">
            <Inline gap={2}>
              <Avatar name="Wong KM" size="sm" />
              <Stack gap={1}>
                <Text size="sm" className="font-semibold">Wong K.M.</Text>
                <Text size="caption" color="tertiary">Registered Nurse</Text>
              </Stack>
            </Inline>
            <button onClick={handleSignOut} aria-label="Sign out" className="p-1.5 rounded hover:bg-[var(--bg-hover-subtle)]">
              <LogOut size={16} style={{ color: "var(--text-secondary)" }} />
            </button>
          </Inline>
        </div>
      </aside>

      {/* Top bar */}
      <header
        className="fixed top-0 right-0 flex items-center justify-between"
        style={{
          left: "var(--sidebar-width)",
          height: "var(--topbar-height)",
          paddingInline: "var(--page-gutter-desktop)",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          zIndex: 10,
        }}
      >
        <div className="type-h3" style={{ color: "var(--text-primary)" }}>{pageTitle}</div>
        <Inline gap={3}>
          <button onClick={toggleLang} className="type-body-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-[var(--bg-hover-subtle)]" style={{ color: "var(--text-secondary)" }}>
            <Languages size={14} />
            {i18n.language === "en" ? "EN" : "中"}
            <ChevronDown size={12} />
          </button>
          <button aria-label="Notifications" className="relative p-2 rounded hover:bg-[var(--bg-hover-subtle)]">
            <Bell size={18} style={{ color: "var(--text-secondary)" }} />
            <span
              className="absolute -top-0.5 -right-0.5 type-caption font-bold grid place-items-center"
              style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "var(--status-error-accent)", color: "#fff", fontSize: 10 }}
            >3</span>
          </button>
          <Avatar name="Wong KM" size="sm" />
        </Inline>
      </header>

      {/* Content — full width, no centering */}
      <main
        style={{
          marginLeft: "var(--sidebar-width)",
          paddingTop: "var(--topbar-height)",
        }}
      >
        <div style={{ padding: `var(--space-6) var(--page-gutter-desktop)` }}>
          {children}
        </div>
      </main>
    </div>
  );
}
