import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { StaffRow } from "@/hooks/useStaff";

interface UnlockPINModalProps {
  open: boolean;
  onClose: () => void;
  staffMember: StaffRow | null;
}

export function UnlockPINModal({ open, onClose, staffMember }: UnlockPINModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { logAction } = useAuditLog();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!staffMember) throw new Error("No staff");
      const { data, error } = await supabase
        .from("staff")
        .update({ pin_failed_attempts: 0, pin_locked_at: null })
        .eq("id", staffMember.id)
        .select("*")
        .single();
      if (error) throw error;
      await logAction({
        action: "STAFF_PIN_UNLOCKED",
        entity_type: "staff",
        entity_id: staffMember.id,
        before_state: {
          pin_failed_attempts: staffMember.pin_failed_attempts,
          pin_locked_at: staffMember.pin_locked_at,
        } as Record<string, unknown>,
        after_state: { pin_failed_attempts: 0, pin_locked_at: null } as Record<string, unknown>,
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t("staff.unlockSuccess"));
      onClose();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => mutation.mutate()}
      title={t("staff.unlockPin")}
      summary={t("staff.unlockPinConfirm")}
      confirmLabel={t("actions.confirm")}
      cancelLabel={t("actions.cancel")}
      tone="approval"
    />
  );
}
