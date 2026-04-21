import { type ReactNode, type HTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, MoreHorizontal, ChevronRight } from "lucide-react";
import { Surface, Inline, Stack } from "./primitives";
import { EmptyState } from "./Feedback";

/* ── Card / StatCard ── */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}
export function Card({ header, footer, padding = "md", className, children, ...rest }: CardProps) {
  return (
    <Surface padding="none" className={cn("flex flex-col", className)} {...rest}>
      {header && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>{header}</div>
      )}
      <div style={{ padding: padding === "none" ? 0 : padding === "lg" ? "var(--panel-padding-lg)" : "var(--panel-padding)" }}>{children}</div>
      {footer && (
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border-subtle)" }}>{footer}</div>
      )}
    </Surface>
  );
}

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  trend?: { direction: "up" | "down" | "flat"; value: ReactNode };
  tone?: "neutral" | "success" | "warning" | "error" | "info";
  icon?: ReactNode;
}
export function StatCard({ label, value, trend, tone = "neutral", icon }: StatCardProps) {
  const accent =
    tone === "success" ? "var(--status-success-accent)" :
    tone === "warning" ? "var(--status-warning-accent)" :
    tone === "error" ? "var(--status-error-accent)" :
    tone === "info" ? "var(--status-info-accent)" :
    "var(--color-neutral-500)";
  return (
    <Card padding="md">
      <Inline justify="between" align="start">
        <Stack gap={2}>
          <span className="type-label" style={{ color: "var(--text-tertiary)" }}>{label}</span>
          <span className="type-display" style={{ color: "var(--text-primary)", fontSize: 32, lineHeight: "36px" }}>{value}</span>
          {trend && (
            <span className="type-caption font-semibold" style={{ color: accent }}>
              {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "—"} {trend.value}
            </span>
          )}
        </Stack>
        {icon && <div className="grid place-items-center w-10 h-10 rounded-lg" style={{ backgroundColor: "var(--bg-subtle)", color: accent }}>{icon}</div>}
      </Inline>
    </Card>
  );
}

/* ── Table ── */
export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  width?: number | string;
}
interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  density?: "compact" | "default" | "relaxed";
  rowKey: (row: T) => string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (s: Set<string>) => void;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}
export function Table<T>({ columns, rows, density = "default", rowKey, selectable, selected, onSelectionChange, empty, onRowClick }: TableProps<T>) {
  const rowH = density === "compact" ? "var(--row-height-compact)" : density === "relaxed" ? "var(--row-height-relaxed)" : "var(--row-height-default)";

  if (rows.length === 0) {
    return <div style={{ backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-md)" }}>{empty ?? <EmptyState title="No data" />}</div>;
  }

  const toggle = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div style={{ backgroundColor: "var(--bg-surface)", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
      <table className="w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "var(--bg-subtle)", height: 40 }}>
            {selectable && <th style={{ width: 40, paddingInline: 12 }} />}
            {columns.map((c) => (
              <th
                key={c.key}
                className="text-left type-label"
                style={{ paddingInline: 12, color: "var(--text-tertiary)", width: c.width }}
              >
                <Inline gap={1}>
                  {c.header}
                  {c.sortable && <ChevronDown size={12} />}
                </Inline>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowKey(row);
            const isSel = selected?.has(id);
            return (
              <tr
                key={id}
                onClick={() => onRowClick?.(row)}
                className="transition-colors"
                style={{
                  height: rowH,
                  backgroundColor: isSel ? "var(--bg-selected)" : "transparent",
                  borderTop: "1px solid var(--border-subtle)",
                  cursor: onRowClick ? "pointer" : "default",
                }}
                onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-row-hover)"; }}
                onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                {selectable && (
                  <td style={{ paddingInline: 12 }}>
                    <input type="checkbox" checked={!!isSel} onChange={() => toggle(id)} onClick={(e) => e.stopPropagation()} style={{ accentColor: "var(--action-primary)" }} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className="type-body-md" style={{ paddingInline: 12, color: "var(--text-primary)" }}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface TableToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
}
export function TableToolbar({ left, right }: TableToolbarProps) {
  return (
    <Inline justify="between" className="w-full" style={{ paddingBlock: 8 }}>
      <div>{left}</div>
      <Inline gap={2}>{right}</Inline>
    </Inline>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  pageSize?: number;
  onPageSizeChange?: (s: number) => void;
}
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <Inline gap={2} justify="end">
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="type-body-sm px-3 py-1.5 rounded disabled:opacity-40 hover:bg-[var(--bg-hover-subtle)]">
        ‹
      </button>
      <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>{page} / {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="type-body-sm px-3 py-1.5 rounded disabled:opacity-40 hover:bg-[var(--bg-hover-subtle)]">
        ›
      </button>
    </Inline>
  );
}

/* ── Tabs ── */
interface TabsProps {
  items: { value: string; label: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  style?: "soft-pill" | "line" | "segmented";
}
export function Tabs({ items, value, onChange, style: variant = "soft-pill" }: TabsProps) {
  if (variant === "line") {
    return (
      <div className="flex" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {items.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              onClick={() => onChange(t.value)}
              className="type-button px-4 py-2.5 transition-all -mb-px"
              style={{
                borderBottom: `2px solid ${active ? "var(--color-iris-500)" : "transparent"}`,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                transitionDuration: "var(--duration-normal)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="inline-flex p-1 gap-1" style={{ backgroundColor: "var(--bg-subtle)", borderRadius: "var(--radius-md)" }}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className="type-button px-3 py-1.5 transition-all"
            style={{
              backgroundColor: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              borderRadius: "var(--radius-sm)",
              boxShadow: active ? "var(--shadow-surface)" : "none",
              transitionDuration: "var(--duration-normal)",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Accordion ── */
interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}
export function Accordion({ title, children, defaultOpen }: AccordionProps) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between py-3 type-body-md font-medium hover:bg-[var(--bg-hover-subtle)] px-2 rounded">
        <span>{title}</span>
        <ChevronRight size={16} style={{ transform: open ? "rotate(90deg)" : "none", transition: `transform var(--duration-slow) var(--easing-standard)` }} />
      </button>
      {open && <div className="pb-3 px-2 type-body-md" style={{ color: "var(--text-secondary)" }}>{children}</div>}
    </div>
  );
}

/* ── Avatar ── */
interface AvatarProps {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}
export function Avatar({ name = "?", src, size = "md" }: AvatarProps) {
  const dim = size === "sm" ? 28 : size === "lg" ? 44 : 36;
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="grid place-items-center font-semibold flex-shrink-0"
      style={{
        width: dim, height: dim, borderRadius: "50%",
        backgroundColor: "var(--color-iris-100)", color: "var(--color-iris-500)",
        fontSize: size === "sm" ? 11 : size === "lg" ? 16 : 13,
        backgroundImage: src ? `url(${src})` : undefined, backgroundSize: "cover", backgroundPosition: "center",
      }}
    >
      {!src && initials}
    </div>
  );
}

/* ── Tooltip (CSS only) ── */
export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity type-caption px-2 py-1 rounded"
        style={{ backgroundColor: "var(--color-onyx-900)", color: "#fff", transitionDuration: "var(--duration-normal)" }}
      >
        {label}
      </span>
    </span>
  );
}

/* ── Timeline ── */
interface ActivityItemProps {
  timestamp: ReactNode;
  actor?: ReactNode;
  action: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}
export function ActivityItem({ timestamp, actor, action, tone = "neutral" }: ActivityItemProps) {
  const dotColor =
    tone === "success" ? "var(--status-success-accent)" :
    tone === "warning" ? "var(--status-warning-accent)" :
    tone === "error" ? "var(--status-error-accent)" :
    tone === "info" ? "var(--status-info-accent)" :
    "var(--color-neutral-500)";
  return (
    <div className="relative pl-6 pb-4">
      <span className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
      <span className="absolute left-2 top-4 bottom-0 w-px" style={{ backgroundColor: "var(--border-subtle)" }} />
      <div className="type-body-md" style={{ color: "var(--text-primary)" }}>
        {actor && <span className="font-semibold">{actor} </span>}
        {action}
      </div>
      <div className="type-caption mt-0.5" style={{ color: "var(--text-tertiary)" }}>{timestamp}</div>
    </div>
  );
}

export function Timeline({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export function RowActionsMenu() {
  return (
    <button aria-label="Row actions" className="p-1 rounded hover:bg-[var(--bg-hover-subtle)]">
      <MoreHorizontal size={16} />
    </button>
  );
}

/* ── Density switcher ── */
interface DensitySwitcherProps {
  value: "compact" | "default" | "relaxed";
  onChange: (v: "compact" | "default" | "relaxed") => void;
}
export function DensitySwitcher({ value, onChange }: DensitySwitcherProps) {
  const opts: { v: DensitySwitcherProps["value"]; label: string }[] = [
    { v: "compact", label: "≡" }, { v: "default", label: "≣" }, { v: "relaxed", label: "☰" },
  ];
  return (
    <div className="inline-flex rounded overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className="px-2.5 py-1 type-caption"
          style={{
            backgroundColor: value === o.v ? "var(--bg-selected)" : "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { ChevronUp };
