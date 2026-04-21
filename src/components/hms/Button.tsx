import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "soft" | "ghost" | "destructive" | "success";
type ButtonSize = "compact" | "default" | "large";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { backgroundColor: "var(--action-primary)", color: "var(--action-primary-text)" },
  soft: { backgroundColor: "var(--action-soft)", color: "var(--action-soft-text)" },
  ghost: { backgroundColor: "transparent", color: "var(--text-primary)" },
  destructive: { backgroundColor: "var(--status-error-bg)", color: "var(--text-destructive)" },
  success: { backgroundColor: "var(--status-success-bg)", color: "var(--status-success-text)" },
};

const variantHover: Record<ButtonVariant, string> = {
  primary: "hover:brightness-110",
  soft: "hover:brightness-[0.98]",
  ghost: "hover:bg-[var(--bg-hover-subtle)]",
  destructive: "hover:brightness-[0.98]",
  success: "hover:brightness-[0.98]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "default", loading, leadingIcon, trailingIcon, fullWidth, className, disabled, children, style, ...rest },
    ref
  ) => {
    const heightVar =
      size === "compact" ? "var(--button-height-compact)" :
      size === "large" ? "44px" : "var(--button-height)";
    const padX = size === "compact" ? 12 : size === "large" ? 20 : 16;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "type-button inline-flex items-center justify-center gap-2 select-none",
          "transition-all outline-none",
          "focus-visible:shadow-[var(--shadow-focus-glow)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantHover[variant],
          fullWidth && "w-full",
          className
        )}
        style={{
          height: heightVar,
          paddingInline: padX,
          borderRadius: "var(--radius-sm)",
          transitionDuration: "var(--duration-normal)",
          ...variantStyles[variant],
          ...style,
        }}
        {...rest}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : leadingIcon}
        {children}
        {!loading && trailingIcon}
      </button>
    );
  }
);
Button.displayName = "Button";

interface IconButtonProps extends Omit<ButtonProps, "leadingIcon" | "trailingIcon" | "children"> {
  icon: ReactNode;
  "aria-label": string;
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = "default", className, style, ...rest }, ref) => {
    const dim = size === "compact" ? 32 : size === "large" ? 44 : 38;
    return (
      <Button
        ref={ref}
        size={size}
        className={cn("!p-0", className)}
        style={{ width: dim, height: dim, ...style }}
        {...rest}
      >
        {icon}
      </Button>
    );
  }
);
IconButton.displayName = "IconButton";

export function ButtonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("inline-flex [&>button]:rounded-none [&>button:first-child]:rounded-l-[var(--radius-sm)] [&>button:last-child]:rounded-r-[var(--radius-sm)] [&>button+button]:border-l-0", className)}
    >
      {children}
    </div>
  );
}
