import { type ReactNode } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Inline, Stack, Heading } from "./primitives";
import { cn } from "@/lib/utils";

/* ── PageHeader ── */
interface PageHeaderProps {
  title: ReactNode;
  breadcrumbs?: { label: ReactNode; href?: string }[];
  actions?: ReactNode;
  description?: ReactNode;
}
export function PageHeader({ title, breadcrumbs, actions, description }: PageHeaderProps) {
  return (
    <div className="w-full" style={{ marginBottom: "var(--space-6)" }}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <Inline justify="between" align="start" className="w-full mt-1">
        <Stack gap={1}>
          <Heading level={1}>{title}</Heading>
          {description && <span className="type-body-md" style={{ color: "var(--text-secondary)" }}>{description}</span>}
        </Stack>
        {actions && <Inline gap={2}>{actions}</Inline>}
      </Inline>
    </div>
  );
}

interface SectionHeaderProps {
  title: ReactNode;
  level?: 2 | 3;
  action?: ReactNode;
}
export function SectionHeader({ title, level = 2, action }: SectionHeaderProps) {
  return (
    <Inline justify="between" className="w-full" style={{ marginBottom: "var(--space-3)" }}>
      <Heading level={level}>{title}</Heading>
      {action}
    </Inline>
  );
}

interface BreadcrumbsProps { items: { label: ReactNode; href?: string }[] }
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 type-caption" style={{ color: "var(--text-tertiary)" }}>
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {it.href && !isLast ? (
              <a href={it.href} className="hover:text-[var(--text-primary)]">{it.label}</a>
            ) : (
              <span style={{ color: isLast ? "var(--text-secondary)" : undefined }}>{it.label}</span>
            )}
            {!isLast && <ChevronRight size={12} />}
          </span>
        );
      })}
    </nav>
  );
}

interface ContextSwitcherProps {
  label: ReactNode;
  current: ReactNode;
}
export function ContextSwitcher({ label, current }: ContextSwitcherProps) {
  return (
    <button
      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded transition-colors hover:bg-[var(--bg-hover-subtle)]"
      style={{ border: "1px solid var(--border-subtle)" }}
    >
      <Stack gap={1} className="text-left">
        <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>{label}</span>
        <span className="type-body-md font-medium" style={{ color: "var(--text-primary)" }}>{current}</span>
      </Stack>
      <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />
    </button>
  );
}

/* ── Enterprise patterns ── */
export function FilterBar({ children, "data-feedback-id": feedbackId }: { children: ReactNode; "data-feedback-id"?: string }) {
  return (
    <div className="w-full flex items-center gap-2 flex-wrap" style={{ marginBottom: "var(--space-4)" }} data-feedback-id={feedbackId}>
      {children}
    </div>
  );
}

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions?: ReactNode;
  selectedLabel?: (n: number) => ReactNode;
  clearLabel?: ReactNode;
}
export function BulkActionBar({ selectedCount, onClear, actions, selectedLabel, clearLabel = "Clear" }: BulkActionBarProps) {
  if (selectedCount === 0) return null;
  return (
    <div
      className="w-full flex items-center justify-between gap-3"
      style={{
        backgroundColor: "var(--color-iris-100)",
        color: "var(--color-iris-500)",
        padding: "10px 14px",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-3)",
      }}
    >
      <span className="type-body-md font-semibold">{selectedLabel ? selectedLabel(selectedCount) : `${selectedCount} items selected`}</span>
      <div className="flex items-center gap-2">
        {actions}
        <button onClick={onClear} className="type-button hover:opacity-80">{clearLabel}</button>
      </div>
    </div>
  );
}

/* ── Stepper ── */
interface StepperProps {
  steps: { label: ReactNode; status: "incomplete" | "current" | "complete" | "error" }[];
}
export function Stepper({ steps }: StepperProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((s, i) => {
        const colorBg =
          s.status === "complete" ? "var(--status-success-accent)" :
          s.status === "current" ? "var(--color-iris-500)" :
          s.status === "error" ? "var(--status-error-accent)" :
          "var(--color-neutral-400)";
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className="grid place-items-center w-7 h-7 rounded-full text-white type-caption font-bold" style={{ backgroundColor: colorBg }}>{i + 1}</div>
              <span className="type-body-sm" style={{ color: s.status === "current" ? "var(--text-primary)" : "var(--text-secondary)" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px mx-3" style={{ backgroundColor: "var(--border-default)" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── StatusTimeline ── */
interface StatusTimelineProps {
  steps: { label: ReactNode; done: boolean; current?: boolean }[];
  orientation?: "horizontal" | "vertical";
}
export function StatusTimeline({ steps, orientation = "horizontal" }: StatusTimelineProps) {
  if (orientation === "vertical") {
    return (
      <div className="flex flex-col">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3 pb-3">
            <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: s.done || s.current ? "var(--status-success-accent)" : "var(--color-neutral-400)" }} />
            <div className="type-body-sm" style={{ color: "var(--text-primary)" }}>{s.label}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center w-full">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.done || s.current ? "var(--status-success-accent)" : "var(--color-neutral-400)" }} />
            <span className="type-caption" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className="flex-1 h-px mx-2" style={{ backgroundColor: "var(--border-default)" }} />}
        </div>
      ))}
    </div>
  );
}

/* ── AuditDiffBlock ── */
interface AuditDiffBlockProps { before: unknown; after: unknown }
export function AuditDiffBlock({ before, after }: AuditDiffBlockProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Before", data: before, tone: "var(--status-error-bg)" },
        { label: "After", data: after, tone: "var(--status-success-bg)" },
      ].map((b) => (
        <div key={b.label} className="p-3 rounded font-mono text-xs whitespace-pre-wrap break-words" style={{ backgroundColor: b.tone, borderRadius: "var(--radius-sm)" }}>
          <div className="type-label mb-2" style={{ color: "var(--text-tertiary)" }}>{b.label}</div>
          {JSON.stringify(b.data, null, 2)}
        </div>
      ))}
    </div>
  );
}

/* ── HandoverPanel ── */
interface HandoverPanelProps {
  sections: { title: ReactNode; count: number; items: ReactNode[] }[];
}
export function HandoverPanel({ sections }: HandoverPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {sections.map((s, i) => (
        <div key={i} className="p-4" style={{ backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-surface)" }}>
          <Inline justify="between" className="mb-3">
            <span className="type-h3">{s.title}</span>
            <span className="type-caption font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--color-iris-100)", color: "var(--color-iris-500)" }}>{s.count}</span>
          </Inline>
          <ul className="space-y-1">
            {s.items.map((it, k) => <li key={k} className="type-body-sm" style={{ color: "var(--text-secondary)" }}>{it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── WallboardTile ── */
interface WallboardTileProps {
  label: ReactNode;
  value: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
}
export function WallboardTile({ label, value, tone = "neutral" }: WallboardTileProps) {
  const bg =
    tone === "success" ? "var(--status-success-accent)" :
    tone === "warning" ? "var(--status-warning-accent)" :
    tone === "error" ? "var(--status-error-accent)" :
    "var(--color-onyx-700)";
  return (
    <div className={cn("p-8 grid place-items-center text-center")} style={{ backgroundColor: bg, color: "#fff", borderRadius: "var(--radius-lg)" }}>
      <div>
        <div className="font-bold" style={{ fontSize: 96, lineHeight: 1 }}>{value}</div>
        <div className="mt-2 type-h2 font-semibold uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
