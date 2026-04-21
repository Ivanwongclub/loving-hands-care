import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";

export interface QRCardProps {
  enrollment: {
    id: string;
    qr_code_uuid: string;
    residents: { name_zh: string; name: string; photo_storage_path: string | null } | null;
  };
  branchName: string;
  branchNameZh: string;
}

/**
 * Printable A6-equivalent (~105mm x 148mm) QR card for a DCU member.
 * Uses inline styles to remain print-faithful even outside the design tokens.
 */
export function QRCard({ enrollment, branchName, branchNameZh }: QRCardProps) {
  const { t } = useTranslation();
  const ref = enrollment.id.slice(-8).toUpperCase();
  const resident = enrollment.residents;

  return (
    <div
      className="qr-card-print"
      style={{
        width: "105mm",
        height: "148mm",
        backgroundColor: "#ffffff",
        border: "1px solid #cccccc",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "#111111",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -0.5 }}>HMS</div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#444" }}>
          <div style={{ fontWeight: 600 }}>{branchNameZh}</div>
          <div>{branchName}</div>
        </div>
      </div>

      {/* QR */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ padding: 8, backgroundColor: "#fff", border: "1px solid #eee" }}>
          <QRCodeSVG value={enrollment.qr_code_uuid} size={160} includeMargin={true} level="M" />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
            {resident?.name_zh ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{resident?.name ?? ""}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ fontSize: 10, color: "#666", lineHeight: 1.3 }}>
          <div style={{ fontWeight: 700, color: "#111" }}>{t("dcu.cardSubtitle")}</div>
          <div>Day Care Unit</div>
          <div style={{ marginTop: 4 }}>{t("dcu.cardFooter")}</div>
          <div>If lost, contact staff</div>
        </div>
        <div style={{ fontSize: 9, fontFamily: "monospace", color: "#999" }}>#{ref}</div>
      </div>
    </div>
  );
}
