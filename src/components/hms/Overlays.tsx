import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./Button";

/* ── Modal ── */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "destructive-confirmation" | "approval";
}
export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const widthMap = { sm: 440, md: 560, lg: 720, xl: 920 };
  return (
    <div
      className="fixed inset-0 grid place-items-center px-4"
      style={{ backgroundColor: "var(--bg-overlay-scrim)", zIndex: 40 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full animate-in fade-in zoom-in-95"
        style={{
          maxWidth: widthMap[size],
          backgroundColor: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-modal)",
          animationDuration: "var(--duration-slow)",
        }}
      >
        {title && (
          <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="type-h3" style={{ color: "var(--text-primary)" }}>{title}</div>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-[var(--bg-hover-subtle)]">
              <X size={18} />
            </button>
          </div>
        )}
        <div style={{ padding: 20 }}>{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2" style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Drawer ── */
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}
export function Drawer({ open, onClose, title, children, footer, width = 480 }: DrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0" style={{ backgroundColor: "var(--bg-overlay-scrim)", zIndex: 30 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full flex flex-col"
        style={{ width, backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-modal)" }}
      >
        {title && (
          <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="type-h3">{title}</div>
            <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-[var(--bg-hover-subtle)]"><X size={18} /></button>
          </div>
        )}
        <div className="flex-1 overflow-auto" style={{ padding: 20 }}>{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2" style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── DropdownMenu (simple controlled) ── */
interface DropdownMenuProps {
  trigger: ReactNode;
  items: { label: ReactNode; onSelect: () => void; tone?: "default" | "destructive" }[];
}
export function DropdownMenu({ trigger, items }: DropdownMenuProps) {
  return (
    <details className="relative inline-block group">
      <summary className="list-none cursor-pointer">{trigger}</summary>
      <div
        className="absolute right-0 mt-1 min-w-[180px] py-1"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-dropdown)",
          zIndex: 20,
        }}
      >
        {items.map((it, i) => (
          <button
            key={i}
            onClick={it.onSelect}
            className="w-full text-left px-3 py-1.5 type-body-md hover:bg-[var(--bg-hover-subtle)]"
            style={{ color: it.tone === "destructive" ? "var(--text-destructive)" : "var(--text-primary)" }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </details>
  );
}

/* ── ConfirmDialog ── */
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  summary: ReactNode;
  consequence?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: "destructive-confirmation" | "approval";
}
export function ConfirmDialog({ open, onClose, onConfirm, title, summary, consequence, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "destructive-confirmation" }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={tone === "approval" ? "success" : "destructive"} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="type-body-md" style={{ color: "var(--text-primary)" }}>{summary}</div>
      {consequence && (
        <div className="mt-3 type-body-sm" style={{ color: "var(--text-destructive)" }}>{consequence}</div>
      )}
    </Modal>
  );
}
