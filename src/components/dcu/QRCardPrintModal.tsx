import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Modal, Button } from "@/components/hms";
import { QRCard, type QRCardProps } from "./QRCard";

interface QRCardPrintModalProps {
  open: boolean;
  onClose: () => void;
  enrollment: QRCardProps["enrollment"] | null;
  branchName: string;
  branchNameZh: string;
}

const PRINT_STYLE_ID = "qr-card-print-style";

export function QRCardPrintModal({
  open,
  onClose,
  enrollment,
  branchName,
  branchNameZh,
}: QRCardPrintModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(PRINT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        .qr-card-print, .qr-card-print * { visibility: visible !important; }
        .qr-card-print {
          position: fixed !important;
          left: 50% !important;
          top: 0 !important;
          transform: translateX(-50%) !important;
          margin: 0 !important;
          box-shadow: none !important;
        }
        @page { size: A6; margin: 6mm; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (!enrollment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dcu.qrCard")}
      size="lg"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            {t("actions.close")}
          </Button>
          <Button
            variant="primary"
            leadingIcon={<Printer size={16} />}
            onClick={() => window.print()}
          >
            {t("actions.print")}
          </Button>
        </>
      }
    >
      <div className="flex justify-center w-full" style={{ padding: "8px 0" }}>
        <QRCard
          enrollment={enrollment}
          branchName={branchName}
          branchNameZh={branchNameZh}
        />
      </div>
    </Modal>
  );
}
