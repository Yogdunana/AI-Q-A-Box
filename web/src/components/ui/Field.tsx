import {
  forwardRef,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { AnimatePresence, m } from "motion/react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { cx } from "../../lib/cx";
import { duration, ease } from "../../lib/motion";
import { IconButton } from "./Button";
import styles from "./Field.module.css";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  counter?: { value: number; max: number };
  hideLabel?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

export function Field({ label, hint, error, optional, counter, hideLabel, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const counterId = counter ? `${id}-counter` : undefined;
  const describedBy = [errorId, hintId, counterId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx(styles.field, className)}>
      <div className={cx(styles.labelRow, hideLabel && "visually-hidden")}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {optional && <span className={styles.optional}>选填</span>}
        </label>
        {counter && <Counter id={counterId!} {...counter} />}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      <AnimatePresence initial={false}>
        {error && (
          <m.p
            key="error"
            id={errorId}
            className={styles.error}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -2 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.fast, ease: ease.out }}
          >
            <AlertCircle aria-hidden="true" />
            {error}
          </m.p>
        )}
      </AnimatePresence>
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Counter({ id, value, max }: { id?: string; value: number; max: number }) {
  const state = value > max ? "over" : value > max * 0.9 ? "near" : "ok";
  return (
    <span id={id} className={styles.counter} data-state={state} aria-live={state === "ok" ? "off" : "polite"}>
      {value} / {max}
    </span>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, leading, trailing, className, style, ...rest },
  ref,
) {
  const prefixRef = useRef<HTMLSpanElement>(null);
  const [prefixWidth, setPrefixWidth] = useState<number>();

  useLayoutEffect(() => {
    if (prefixRef.current) setPrefixWidth(prefixRef.current.offsetWidth);
  }, [leading]);

  const input = (
    <input
      ref={ref}
      className={cx(styles.control, className)}
      aria-invalid={invalid || undefined}
      style={{
        ...style,
        ...(leading && prefixWidth ? { paddingLeft: prefixWidth + 2 } : null),
        ...(trailing ? { paddingRight: 44 } : null),
      } as CSSProperties}
      {...rest}
    />
  );

  if (!leading && !trailing) return input;
  return (
    <div className={styles.affixWrap}>
      {leading && (
        <span ref={prefixRef} className={styles.prefix} aria-hidden="true">
          {leading}
        </span>
      )}
      {input}
      {trailing && <span className={styles.suffix}>{trailing}</span>}
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "trailing">>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        {...props}
        trailing={
          <IconButton
            size="sm"
            label={visible ? "隐藏密码" : "显示密码"}
            aria-pressed={undefined}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </IconButton>
        }
      />
    );
  },
);

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  minRows?: number;
  maxRows?: number;
}

/** Textarea that grows with its content between minRows and maxRows. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, minRows = 3, maxRows = 14, className, value, onChange, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || 24;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    el.style.height = "auto";
    const min = line * minRows + padding;
    const max = line * maxRows + padding;
    const next = Math.min(Math.max(el.scrollHeight, min), max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={setRef}
      className={cx(styles.control, styles.textarea, className)}
      aria-invalid={invalid || undefined}
      value={value}
      onChange={onChange}
      rows={minRows}
      {...rest}
    />
  );
});
