import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { WallboardTile } from "@/components/hms";
import { ProtectedRoute } from "@/lib/ProtectedRoute";

export const Route = createFileRoute("/alerts/wallboard")({
  component: WallboardPage,
});

function WallboardPage() {
  const { t } = useTranslation();
  return (
    <ProtectedRoute>
    <div className="fixed inset-0 p-6" style={{ backgroundColor: "var(--color-onyx-900)", color: "#fff" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="font-extrabold tracking-tight" style={{ fontSize: 32 }}>HMS Wallboard · 警報顯示</div>
        <div className="type-h2 font-mono">{new Date().toLocaleTimeString()}</div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <WallboardTile label={t("dashboard.openAlerts")} value="3" tone="warning" />
        <WallboardTile label="Critical · 危急" value="1" tone="error" />
        <WallboardTile label={t("dashboard.overdueTasks")} value="7" tone="error" />
        <WallboardTile label="Acknowledged · 已確認" value="12" tone="success" />
        <WallboardTile label="Active Staff · 在職員工" value="48" />
        <WallboardTile label="Residents · 院友" value="127" />
      </div>
    </div>
  );
}
