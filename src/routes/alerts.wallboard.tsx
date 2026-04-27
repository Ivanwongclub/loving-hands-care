import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { WallboardTile } from "@/components/hms";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import { useAlerts } from "@/hooks/useAlerts";
import { useBranches } from "@/hooks/useBranches";

export const Route = createFileRoute("/alerts/wallboard")({
  component: WallboardPage,
});

function WallboardPage() {
  const { t } = useTranslation();
  const { branches } = useBranches();
  const branchId = branches[0]?.id ?? null;
  const { alerts } = useAlerts({ branchId });

  const critical = alerts.filter((a) => a.severity === "CRITICAL" && a.status === "OPEN").length;
  const high = alerts.filter((a) => a.severity === "HIGH" && a.status === "OPEN").length;
  const open = alerts.filter((a) => a.status === "OPEN").length;
  const acked = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
  const resolved = alerts.filter((a) => a.status === "RESOLVED").length;
  const total = alerts.length;

  return (
    <ProtectedRoute>
    <div className="fixed inset-0 p-6" style={{ backgroundColor: "var(--color-onyx-900)", color: "#fff" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="font-extrabold tracking-tight" style={{ fontSize: 32 }}>HMS Wallboard · 警報顯示</div>
        <div className="type-h2 font-mono">{new Date().toLocaleTimeString()}</div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <WallboardTile label={t("dashboard.openAlerts")} value={String(open)} tone="warning" />
        <WallboardTile label="Critical · 危急" value={String(critical)} tone="error" />
        <WallboardTile label="High · 高危" value={String(high)} tone="error" />
        <WallboardTile label="Acknowledged · 已確認" value={String(acked)} tone="success" />
        <WallboardTile label="Resolved · 已解決" value={String(resolved)} />
        <WallboardTile label="Total Alerts · 全部警報" value={String(total)} />
      </div>
    </div>
    </ProtectedRoute>
  );
}
