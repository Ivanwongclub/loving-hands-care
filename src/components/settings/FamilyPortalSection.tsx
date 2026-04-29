import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MoreHorizontal } from "lucide-react";
import {
  PageHeader, Table, Badge, Button, EmptyState, Stack, Skeleton,
  DropdownMenu, IconButton, ConfirmDialog,
  type Column,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import { timeAgo } from "@/components/alerts/timeUtils";
import { InvitePortalUserModal } from "./InvitePortalUserModal";

interface PortalUserRow {
  id: string;
  name: string;
  name_zh: string | null;
  relationship: string;
  portal_email: string | null;
  is_portal_user: boolean;
  portal_invited_at: string | null;
  portal_first_login_at: string | null;
  portal_last_login_at: string | null;
  auth_user_id: string | null;
  residents: { id: string; name: string; name_zh: string | null; branch_id: string } | null;
  invited_by: { name: string; name_zh: string | null } | null;
}

export function FamilyPortalSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { staff } = useCurrentStaff();
  const { branches } = useBranches();
  const { logAction } = useAuditLog();

  const isSysAdmin = staff?.role === "SYSTEM_ADMIN";
  const isBranchAdmin = staff?.role === "BRANCH_ADMIN";
  const canManage = isSysAdmin || isBranchAdmin;

  const branchId = branches[0]?.id ?? null;
  const allowedBranchIds = useMemo(() => {
    if (isSysAdmin) return null; // null = all branches
    return new Set(branches.map((b) => b.id));
  }, [branches, isSysAdmin]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PortalUserRow | null>(null);

  const { data: portalUsers = [], isLoading, refetch } = useQuery({
    queryKey: ["familyPortal", branchId, isSysAdmin ? "all" : Array.from(allowedBranchIds ?? []).sort().join(",")],
    enabled: !!staff,
    queryFn: async (): Promise<PortalUserRow[]> => {
      const { data, error } = await supabase
        .from("resident_contacts")
        .select(`
          id, name, name_zh, relationship,
          portal_email, is_portal_user, auth_user_id,
          portal_invited_at, portal_first_login_at, portal_last_login_at,
          residents:resident_id(id, name, name_zh, branch_id),
          invited_by:portal_invited_by_staff_id(name, name_zh)
        `)
        .or("is_portal_user.eq.true,portal_invited_at.not.is.null")
        .order("portal_invited_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as PortalUserRow[];
      if (!allowedBranchIds) return rows;
      return rows.filter((u) => u.residents?.branch_id && allowedBranchIds.has(u.residents.branch_id));
    },
  });

  const handleResend = async (row: PortalUserRow) => {
    if (!row.portal_email || !row.residents) return;
    try {
      const { error } = await supabase.functions.invoke("invite-family-portal-user", {
        body: { contactId: row.id, portalEmail: row.portal_email, residentId: row.residents.id },
      });
      if (error) throw error;
      await supabase
        .from("resident_contacts")
        .update({ portal_invited_at: new Date().toISOString() })
        .eq("id", row.id);
      await logAction({
        action: "FAMILY_PORTAL_INVITED",
        entity_type: "resident_contacts",
        entity_id: row.id,
        branch_id: row.residents.branch_id,
        after_state: { portal_email: row.portal_email, resent: true },
      });
      toast.success(t("familyPortal.settings.invite.success"));
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget?.residents) return;
    const target = revokeTarget;
    setRevokeTarget(null);
    try {
      const { error } = await supabase
        .from("resident_contacts")
        .update({ is_portal_user: false, auth_user_id: null, portal_email: null })
        .eq("id", target.id);
      if (error) throw error;
      await logAction({
        action: "FAMILY_PORTAL_REVOKED",
        entity_type: "resident_contacts",
        entity_id: target.id,
        branch_id: target.residents!.branch_id,
        before_state: { is_portal_user: true, auth_user_id: target.auth_user_id },
        after_state: { is_portal_user: false, auth_user_id: null },
      });
      toast.success(t("familyPortal.settings.revoke.success"));
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const statusBadge = (row: PortalUserRow) => {
    if (!row.is_portal_user) return <Badge tone="neutral">{t("familyPortal.settings.status.revoked")}</Badge>;
    if (!row.portal_first_login_at) return <Badge tone="warning">{t("familyPortal.settings.status.pending")}</Badge>;
    return <Badge tone="success">{t("familyPortal.settings.status.active")}</Badge>;
  };

  const columns: Column<PortalUserRow>[] = [
    {
      key: "resident",
      header: t("familyPortal.settings.columns.resident"),
      cell: (row) => (
        <span className="type-body-md" style={{ color: "var(--text-primary)" }}>
          {row.residents?.name_zh ?? row.residents?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "contact",
      header: t("familyPortal.settings.columns.contact"),
      cell: (row) => (
        <Stack gap={1}>
          <span className="type-body-md" style={{ color: "var(--text-primary)" }}>
            {row.name_zh ?? row.name}
          </span>
          <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>{row.relationship}</span>
        </Stack>
      ),
    },
    {
      key: "email",
      header: t("familyPortal.settings.columns.email"),
      cell: (row) => (
        <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>{row.portal_email ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: t("familyPortal.settings.columns.status"),
      width: 130,
      cell: (row) => statusBadge(row),
    },
    {
      key: "lastLogin",
      header: t("familyPortal.settings.columns.lastLogin"),
      width: 140,
      cell: (row) => (
        <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>
          {row.portal_last_login_at ? timeAgo(row.portal_last_login_at, t) : "—"}
        </span>
      ),
    },
    {
      key: "invitedBy",
      header: t("familyPortal.settings.columns.invitedBy"),
      width: 140,
      cell: (row) => (
        <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>
          {row.invited_by?.name_zh ?? row.invited_by?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 60,
      cell: (row) => {
        const isPending = row.is_portal_user && !row.portal_first_login_at;
        const items: { label: string; onSelect: () => void; tone?: "default" | "destructive" }[] = [];
        if (isPending) {
          items.push({
            label: t("familyPortal.settings.actions.resend"),
            onSelect: () => void handleResend(row),
          });
        }
        if (row.is_portal_user && canManage) {
          items.push({
            label: t("familyPortal.settings.actions.revoke"),
            tone: "destructive",
            onSelect: () => setRevokeTarget(row),
          });
        }
        items.push({
          label: t("familyPortal.settings.actions.viewResident"),
          onSelect: () => {
            if (row.residents) void navigate({ to: "/residents/$id", params: { id: row.residents.id } });
          },
        });
        return (
          <DropdownMenu
            trigger={<IconButton aria-label="Actions" icon={<MoreHorizontal size={16} />} variant="ghost" size="compact" />}
            items={items}
          />
        );
      },
    },
  ];

  if (!canManage) {
    return (
      <EmptyState
        title={t("settings.comingSoon")}
        description={t("familyPortal.settings.description")}
      />
    );
  }

  return (
    <Stack gap={4}>
      <PageHeader
        title={t("familyPortal.settings.title")}
        description={t("familyPortal.settings.description")}
        actions={
          <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => setInviteOpen(true)}>
            {t("familyPortal.settings.addUser")}
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton height={200} />
      ) : portalUsers.length === 0 ? (
        <EmptyState
          title={t("familyPortal.settings.noUsers")}
          description={t("familyPortal.settings.noUsersDescription")}
          action={
            <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => setInviteOpen(true)}>
              {t("familyPortal.settings.addUser")}
            </Button>
          }
        />
      ) : (
        <Table<PortalUserRow> columns={columns} rows={portalUsers} rowKey={(r) => r.id} />
      )}

      <InvitePortalUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        branchId={branchId}
        onInvited={async () => { await refetch(); }}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void handleRevoke()}
        title={t("familyPortal.settings.revoke.title")}
        summary={t("familyPortal.settings.revoke.confirmMessage")}
        confirmLabel={t("familyPortal.settings.revokeConfirm")}
        cancelLabel={t("actions.cancel")}
        tone="destructive-confirmation"
      />
    </Stack>
  );
}
