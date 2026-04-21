import { type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Info, CheckCircle2, AlertTriangle, XCircle, X, Loader2 } from "lucide-react";

type Tone = "neutral" | "info" | "success" | "warning" | "error";

const toneTokens: Record<Tone, { bg: string; text: string; accent: string }> = {
  neutral: { bg: "var(--color-neutral-200)", text: "var(--text-secondary)", accent: "var(--color-neutral-500)" },
  info: { bg: "var(--status-info-bg)", text: "var(--status-info-text)", accent: "var(--status-info-accent)" },
  success: { bg: "var(--status-success-bg)", text: "var(--status-success-text)", accent: "var(--status-success-accent)" },
  warning: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", accent: "var(--status-warning-accent)" },
  error: { bg: "var(--status-error-bg)", text: "var(--status-error-text)", accent: "var(--status-error-accent)" },
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  emphasis?: "subtle" | "strong";
  dot?: boolean;
  children?: ReactNode;
}
export function Badge({ tone = "neutral", emphasis = "subtle", dot, className, children, style, ...rest }: BadgeProps) {
  const t = toneTokens[tone];
  const isStrong = emphasis === "strong";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 type-caption font-semibold whitespace-nowrap", className)}
      style={{
        backgroundColor: isStrong ? t.accent : t.bg,
        color: isStrong ? "#fff" : t.text,
        paddingInline: 10,
        paddingBlock: 3,
        borderRadius: "var(--radius-pill)",
        ...style,
      }}
      {...rest}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isStrong ? "#fff" : t.accent }} />}
      {children}
    </span>
  );
}

export function StatusDot({ tone = "neutral" }: { tone?: Tone }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: toneTokens[tone].accent }} />;
}

interface AlertProps {
  severity?: "info" | "success" | "warning" | "error" | "critical";
  layout?: "inline" | "banner" | "panel";
  title?: ReactNode;
  description?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}
export function Alert({ severity = "info", layout = "panel", title, description, onDismiss, className }: AlertProps) {
  const tone: Tone = severity === "critical" ? "error" : (severity as Tone);
  const t = toneTokens[tone];
  const Icon = severity === "success" ? CheckCircle2 : severity === "warning" ? AlertTriangle : (severity === "error" || severity === "critical") ? XCircle : Info;
  const isCritical = severity === "critical";
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-3 w-full", className)}
      style={{
        backgroundColor: t.bg,
        color: t.text,
        padding: layout === "inline" ? "8px 12px" : "14px 16px",
        borderRadius: layout === "banner" ? 0 : "var(--radius-md)",
        borderLeft: isCritical ? `4px solid ${t.accent}` : undefined,
      }}
    >
      <Icon size={18} style={{ color: t.accent, flexShrink: 0, marginTop: 1 }} />
      <div className="flex-1 min-w-0">
        {title && <div className="type-body-md font-semibold" style={{ color: t.text }}>{title}</div>}
        {description && <div className="type-body-sm mt-0.5" style={{ color: t.text, opacity: 0.9 }}>{description}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Banner(props: AlertProps) {
  return <Alert {...props} layout="banner" />;
}

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? 14 : size === "lg" ? 28 : 18;
  return <Loader2 size={dim} className="animate-spin" style={{ color: "var(--text-secondary)" }} />;
}

interface SkeletonProps {
  variant?: "text" | "block" | "circle" | "row";
  width?: number | string;
  height?: number | string;
  className?: string;
}
export function Skeleton({ variant = "block", width, height, className }: SkeletonProps) {
  const w = width ?? (variant === "circle" ? 32 : "100%");
  const h = height ?? (variant === "text" ? 14 : variant === "circle" ? 32 : variant === "row" ? 44 : 80);
  return (
    <div
      className={cn("animate-shimmer", className)}
      style={{
        width: w,
        height: h,
        borderRadius: variant === "circle" ? "50%" : variant === "text" ? 4 : "var(--radius-sm)",
      }}
    />
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      {icon && <div className="mb-4" style={{ color: "var(--text-tertiary)" }}>{icon}</div>}
      {title && <div className="type-h3" style={{ color: "var(--text-primary)" }}>{title}</div>}
      {description && <div className="type-body-md mt-2 max-w-md" style={{ color: "var(--text-secondary)" }}>{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function EscalationIndicator({ level }: { level: 0 | 1 | 2 }) {
  const tone: Tone = level === 0 ? "neutral" : level === 1 ? "warning" : "error";
  return <Badge tone={tone} emphasis="strong" dot>L{level}</Badge>;
}
