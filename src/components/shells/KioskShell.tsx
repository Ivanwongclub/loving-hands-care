import { type ReactNode } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Inline } from "@/components/hms";

export function KioskShell({ children, online = true }: { children: ReactNode; online?: boolean }) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-page)" }}>
      <header className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
        <span className="type-body-md font-semibold">Central Branch · 中央院舍</span>
        <Inline gap={2}>
          {online ? <Wifi size={16} style={{ color: "var(--status-success-accent)" }} /> : <WifiOff size={16} style={{ color: "var(--status-error-accent)" }} />}
          <span className="type-caption" style={{ color: online ? "var(--status-success-text)" : "var(--status-error-text)" }}>
            {online ? "Online" : "Offline"}
          </span>
        </Inline>
      </header>

      <main className="flex-1 grid place-items-center p-6">
        <div className="w-full" style={{ maxWidth: 480 }}>{children}</div>
      </main>

      <footer className="flex items-center justify-between px-6 py-3" style={{ borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
        <button className="type-button px-3 py-2 rounded hover:bg-[var(--bg-hover-subtle)]" style={{ color: "var(--text-link)" }}>
          Manual Check-In · 手動登記
        </button>
        <ClockDisplay />
      </footer>
    </div>
  );
}

function ClockDisplay() {
  const now = new Date();
  return <span className="type-body-md font-mono" style={{ color: "var(--text-secondary)" }}>{now.toLocaleTimeString()}</span>;
}
