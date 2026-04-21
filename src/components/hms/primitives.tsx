import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────
 * Foundation: Box / Stack / Inline / Divider / Surface
 * ────────────────────────────────────────────────────────── */

export const Box = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => <div ref={ref} className={cn(className)} {...rest} />
);
Box.displayName = "Box";

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
  align?: "start" | "center" | "end" | "stretch";
}
export const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({ gap = 4, align = "stretch", className, style, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col", className)}
      style={{
        gap: `var(--space-${gap})`,
        alignItems: align === "start" ? "flex-start" : align === "end" ? "flex-end" : align,
        ...style,
      }}
      {...rest}
    />
  )
);
Stack.displayName = "Stack";

interface InlineProps extends HTMLAttributes<HTMLDivElement> {
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
  align?: "start" | "center" | "end" | "baseline";
  justify?: "start" | "center" | "end" | "between" | "around";
  wrap?: boolean;
}
export const Inline = forwardRef<HTMLDivElement, InlineProps>(
  ({ gap = 3, align = "center", justify = "start", wrap, className, style, ...rest }, ref) => {
    const justifyMap = {
      start: "flex-start", center: "center", end: "flex-end",
      between: "space-between", around: "space-around",
    };
    return (
      <div
        ref={ref}
        className={cn("flex", wrap && "flex-wrap", className)}
        style={{
          gap: `var(--space-${gap})`,
          alignItems: align === "start" ? "flex-start" : align === "end" ? "flex-end" : align,
          justifyContent: justifyMap[justify],
          ...style,
        }}
        {...rest}
      />
    );
  }
);
Inline.displayName = "Inline";

export function Divider({ className, ...rest }: HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={cn("border-0 h-px w-full", className)}
      style={{ backgroundColor: "var(--border-subtle)" }}
      {...rest}
    />
  );
}

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  elevation?: "flat" | "surface" | "elevated";
}
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ padding = "md", elevation = "surface", className, style, ...rest }, ref) => {
    const padMap = { none: 0, sm: "var(--panel-padding)", md: "var(--panel-padding)", lg: "var(--panel-padding-lg)" };
    const shadowMap = { flat: "none", surface: "var(--shadow-surface)", elevated: "var(--shadow-elevated)" };
    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          backgroundColor: "var(--bg-surface)",
          borderRadius: "var(--radius-md)",
          boxShadow: shadowMap[elevation],
          padding: padMap[padding],
          ...style,
        }}
        {...rest}
      />
    );
  }
);
Surface.displayName = "Surface";

/* ──────────────────────────────────────────────────────────
 * Typography
 * ────────────────────────────────────────────────────────── */

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | "display";
  children?: ReactNode;
}
export function Heading({ level = 2, className, children, ...rest }: HeadingProps) {
  const cls = level === "display" ? "type-display" : level === 1 ? "type-h1" : level === 2 ? "type-h2" : "type-h3";
  const tag = level === "display" || level === 1 ? "h1" : level === 2 ? "h2" : "h3";
  const props = { className: cn(cls, className), style: { color: "var(--text-primary)" }, ...rest };
  if (tag === "h1") return <h1 {...props}>{children}</h1>;
  if (tag === "h2") return <h2 {...props}>{children}</h2>;
  return <h3 {...props}>{children}</h3>;
}

type TextSize = "lg" | "md" | "sm" | "caption" | "label";
type TextColor = "primary" | "secondary" | "tertiary" | "disabled" | "inverse" | "destructive";
interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  size?: TextSize;
  color?: TextColor;
  as?: "span" | "p" | "div";
  children?: ReactNode;
}
export function Text({ size = "md", color = "primary", as: Tag = "span", className, children, style, ...rest }: TextProps) {
  const sizeMap: Record<TextSize, string> = {
    lg: "type-body-lg", md: "type-body-md", sm: "type-body-sm",
    caption: "type-caption", label: "type-label",
  };
  const colorVar: Record<TextColor, string> = {
    primary: "var(--text-primary)",
    secondary: "var(--text-secondary)",
    tertiary: "var(--text-tertiary)",
    disabled: "var(--text-disabled)",
    inverse: "var(--text-inverse)",
    destructive: "var(--text-destructive)",
  };
  return (
    <Tag className={cn(sizeMap[size], className)} style={{ color: colorVar[color], ...style }} {...rest}>
      {children}
    </Tag>
  );
}

interface LabelProps extends HTMLAttributes<HTMLLabelElement> {
  htmlFor?: string;
  required?: boolean;
  children?: ReactNode;
}
export function Label({ htmlFor, required, className, children, ...rest }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("type-body-sm font-medium block", className)}
      style={{ color: "var(--text-primary)", marginBottom: "var(--space-2)" }}
      {...rest}
    >
      {children}
      {required && <span style={{ color: "var(--text-destructive)", marginLeft: 4 }}>*</span>}
    </label>
  );
}
