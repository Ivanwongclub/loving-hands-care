import { type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, forwardRef, useRef, useState } from "react";
import { Search, Eye, EyeOff, Calendar, Clock, ChevronDown, ScanLine, X, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./primitives";

type FieldState = "default" | "success" | "warning" | "error" | "disabled" | "readonly";

const stateBorder: Record<FieldState, string> = {
  default: "var(--border-default)",
  success: "var(--border-success)",
  warning: "var(--border-warning)",
  error: "var(--border-error)",
  disabled: "var(--border-default)",
  readonly: "var(--border-default)",
};

interface BaseFieldProps {
  state?: FieldState;
  size?: "compact" | "default";
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const fieldBaseClass = "w-full type-body-md outline-none transition-all";
const fieldFocusClass = "focus:shadow-[var(--shadow-focus-glow)]";

function fieldStyle(state: FieldState, size: "compact" | "default"): React.CSSProperties {
  return {
    height: size === "compact" ? 36 : "var(--field-height)",
    backgroundColor: state === "disabled" ? "var(--bg-disabled)" : "var(--color-dorian-300)",
    color: state === "disabled" ? "var(--text-disabled)" : "var(--text-primary)",
    border: `1px solid ${stateBorder[state]}`,
    borderRadius: "var(--radius-sm)",
    paddingInline: 12,
    transitionDuration: "var(--duration-normal)",
  };
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">, BaseFieldProps {}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ state = "default", size = "default", leadingIcon, trailingIcon, className, style, disabled, readOnly, ...rest }, ref) => {
    const effective: FieldState = disabled ? "disabled" : readOnly ? "readonly" : state;
    return (
      <div className="relative w-full">
        {leadingIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-tertiary)" }}>
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(fieldBaseClass, fieldFocusClass, className)}
          style={{
            ...fieldStyle(effective, size),
            paddingLeft: leadingIcon ? 36 : 12,
            paddingRight: trailingIcon ? 36 : 12,
            ...style,
          }}
          {...rest}
        />
        {trailingIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }}>
            {trailingIcon}
          </span>
        )}
      </div>
    );
  }
);
TextField.displayName = "TextField";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseFieldProps {}
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ state = "default", className, style, disabled, readOnly, rows = 3, ...rest }, ref) => {
    const effective: FieldState = disabled ? "disabled" : readOnly ? "readonly" : state;
    const base = fieldStyle(effective, "default");
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(fieldBaseClass, fieldFocusClass, className)}
        style={{ ...base, height: "auto", paddingBlock: 10, ...style }}
        {...rest}
      />
    );
  }
);
TextArea.displayName = "TextArea";

export const SearchField = forwardRef<HTMLInputElement, TextFieldProps & { onClear?: () => void }>(
  ({ value, onClear, ...rest }, ref) => (
    <TextField
      ref={ref}
      value={value}
      leadingIcon={<Search size={16} />}
      trailingIcon={
        value && onClear ? (
          <button type="button" onClick={onClear} aria-label="Clear" className="hover:opacity-70">
            <X size={14} />
          </button>
        ) : undefined
      }
      {...rest}
    />
  )
);
SearchField.displayName = "SearchField";

export const PasswordField = forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => {
  const [show, setShow] = useState(false);
  return (
    <TextField
      ref={ref}
      type={show ? "text" : "password"}
      trailingIcon={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password" className="hover:opacity-70">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
      {...props}
    />
  );
});
PasswordField.displayName = "PasswordField";

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  state?: FieldState;
  options: { value: string; label: string }[];
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ state = "default", options, className, style, disabled, ...rest }, ref) => {
    const effective: FieldState = disabled ? "disabled" : state;
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(fieldBaseClass, fieldFocusClass, "appearance-none pr-9", className)}
          style={{ ...fieldStyle(effective, "default"), ...style }}
          {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }
);
Select.displayName = "Select";

export function Checkbox({ label, indeterminate, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  if (ref.current) ref.current.indeterminate = !!indeterminate;
  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer", className)}>
      <input ref={ref} type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: "var(--action-primary)" }} {...rest} />
      {label && <span className="type-body-md" style={{ color: "var(--text-primary)" }}>{label}</span>}
    </label>
  );
}

export function Radio({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer", className)}>
      <input type="radio" className="w-4 h-4" style={{ accentColor: "var(--action-primary)" }} {...rest} />
      {label && <span className="type-body-md" style={{ color: "var(--text-primary)" }}>{label}</span>}
    </label>
  );
}

interface SwitchProps {
  checked?: boolean;
  onChange?: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className={cn("inline-flex items-center gap-3", disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className="relative w-10 h-6 rounded-full transition-colors"
        style={{
          backgroundColor: checked ? "var(--status-success-accent)" : "var(--color-neutral-400)",
          transitionDuration: "var(--duration-normal)",
        }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"
          style={{ left: 2, transform: checked ? "translateX(16px)" : "translateX(0)", transitionDuration: "var(--duration-normal)" }}
        />
      </button>
      {label && <span className="type-body-md">{label}</span>}
    </label>
  );
}

export const DateField = forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => (
  <TextField ref={ref} type="date" trailingIcon={<Calendar size={16} />} {...props} />
));
DateField.displayName = "DateField";

export const TimeField = forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => (
  <TextField ref={ref} type="time" trailingIcon={<Clock size={16} />} {...props} />
));
TimeField.displayName = "TimeField";

interface NumberFieldProps extends TextFieldProps {
  unit?: string;
  step?: number;
  onValueChange?: (v: number) => void;
  numericValue?: number;
}
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ unit, step = 1, onValueChange, numericValue, ...rest }, ref) => {
    const inc = (delta: number) => {
      const next = (numericValue ?? 0) + delta;
      onValueChange?.(next);
    };
    return (
      <div className="relative w-full">
        <TextField
          ref={ref}
          type="number"
          value={numericValue}
          onChange={(e) => onValueChange?.(Number(e.target.value))}
          {...rest}
          style={{ paddingRight: unit ? 96 : 72 }}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {unit && (
            <span className="type-caption mr-1" style={{ color: "var(--text-tertiary)" }}>{unit}</span>
          )}
          <button type="button" aria-label="decrement" onClick={() => inc(-step)} className="w-6 h-6 grid place-items-center rounded hover:bg-[var(--bg-hover-subtle)]">
            <Minus size={12} />
          </button>
          <button type="button" aria-label="increment" onClick={() => inc(step)} className="w-6 h-6 grid place-items-center rounded hover:bg-[var(--bg-hover-subtle)]">
            <Plus size={12} />
          </button>
        </div>
      </div>
    );
  }
);
NumberField.displayName = "NumberField";

/* ── PIN field ── */
interface PINFieldProps {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  state?: "default" | "error" | "locked";
  attemptsRemaining?: number;
  attemptsLabel?: string;
}
export function PINField({ value, onChange, length = 4, state = "default", attemptsRemaining, attemptsLabel }: PINFieldProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const setAt = (i: number, ch: string) => {
    const cleaned = ch.replace(/\D/g, "").slice(-1);
    const next = (value.padEnd(length, " ").substring(0, i) + cleaned + value.padEnd(length, " ").substring(i + 1)).trimEnd();
    onChange(next.slice(0, length));
    if (cleaned && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn("flex gap-3", state === "error" && "animate-pin-shake")}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            inputMode="numeric"
            maxLength={1}
            value={d ? "•" : ""}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            disabled={state === "locked"}
            className="text-center text-2xl font-semibold outline-none transition-all focus:shadow-[var(--shadow-focus-glow)]"
            style={{
              width: 52,
              height: 62,
              borderRadius: "var(--radius-sm)",
              backgroundColor: state === "locked" ? "var(--bg-disabled)" : "var(--bg-surface)",
              border: `1.5px solid ${state === "error" ? "var(--border-error)" : "var(--border-default)"}`,
              color: "var(--text-primary)",
            }}
          />
        ))}
      </div>
      {typeof attemptsRemaining === "number" && (
        <span className="type-caption" style={{ color: state === "error" ? "var(--text-destructive)" : "var(--text-secondary)" }}>
          {attemptsLabel ?? `${attemptsRemaining} attempts remaining`}
        </span>
      )}
    </div>
  );
}

/* ── Barcode scan surface ── */
interface BarcodeInputSurfaceProps {
  status?: "idle" | "scanning" | "success" | "error";
  scannedValue?: string;
  onRescan?: () => void;
  rescanLabel?: string;
  idleHint?: string;
}
export function BarcodeInputSurface({ status = "idle", scannedValue, onRescan, rescanLabel = "Rescan", idleHint }: BarcodeInputSurfaceProps) {
  const bg =
    status === "success" ? "var(--status-success-bg)" :
    status === "error" ? "var(--status-error-bg)" : "var(--bg-subtle)";
  const border =
    status === "success" ? "var(--border-success)" :
    status === "error" ? "var(--border-error)" : "var(--border-default)";
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn("w-full grid place-items-center transition-all", status === "scanning" && "animate-pulse", status === "error" && "animate-pin-shake")}
        style={{
          minHeight: 180,
          borderRadius: "var(--radius-md)",
          border: `2px dashed ${border}`,
          backgroundColor: bg,
          padding: 24,
        }}
      >
        <ScanLine size={56} style={{ color: "var(--text-tertiary)" }} />
        {scannedValue && (
          <div className="mt-3 type-body-md font-mono" style={{ color: "var(--text-primary)" }}>
            {scannedValue}
          </div>
        )}
        {!scannedValue && idleHint && (
          <div className="mt-2 type-caption" style={{ color: "var(--text-tertiary)" }}>{idleHint}</div>
        )}
      </div>
      {scannedValue && (
        <button type="button" onClick={onRescan} className="type-button px-3 py-1.5 rounded hover:bg-[var(--bg-hover-subtle)]" style={{ color: "var(--text-link)" }}>
          {rescanLabel}
        </button>
      )}
    </div>
  );
}

/* ── Form field wrapper / helper ── */
interface FormFieldProps {
  label?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  helper?: ReactNode;
  validation?: { tone: "error" | "warning" | "success"; message: ReactNode };
  children: ReactNode;
}
export function FormField({ label, required, htmlFor, helper, validation, children }: FormFieldProps) {
  return (
    <div className="w-full">
      {label && <Label htmlFor={htmlFor} required={required}>{label}</Label>}
      {children}
      {helper && !validation && (
        <div className="mt-1.5 type-caption" style={{ color: "var(--text-tertiary)" }}>{helper}</div>
      )}
      {validation && (
        <div
          className="mt-1.5 type-caption"
          style={{
            color:
              validation.tone === "error" ? "var(--text-destructive)" :
              validation.tone === "warning" ? "var(--status-warning-text)" :
              "var(--status-success-text)",
          }}
        >
          {validation.message}
        </div>
      )}
    </div>
  );
}

export function HelperText({ children }: { children: ReactNode }) {
  return <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>{children}</span>;
}

export function ValidationMessage({ tone, children }: { tone: "error" | "warning" | "success"; children: ReactNode }) {
  const color =
    tone === "error" ? "var(--text-destructive)" :
    tone === "warning" ? "var(--status-warning-text)" :
    "var(--status-success-text)";
  return <span className="type-caption font-medium" style={{ color }}>{children}</span>;
}
