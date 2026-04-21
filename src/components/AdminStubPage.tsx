import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { PageHeader, EmptyState } from "@/components/hms";
import { ProtectedRoute } from "@/lib/ProtectedRoute";

interface AdminStubProps {
  titleKey: string;
  description?: ReactNode;
}

export function AdminStubPage({ titleKey }: AdminStubProps) {
  const { t } = useTranslation();
  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t(titleKey)}>
        <PageHeader title={t(titleKey)} />
        <div style={{ backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-surface)" }}>
          <EmptyState
            icon={<Inbox size={48} />}
            title={t("common.comingSoon")}
            description={t(titleKey)}
          />
        </div>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}
