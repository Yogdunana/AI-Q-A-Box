import { useId, type KeyboardEvent, type ReactNode } from "react";
import { LayoutGroup, m } from "motion/react";
import { cx } from "../../lib/cx";
import { spring } from "../../lib/motion";
import styles from "./Switch.module.css";

interface SwitchProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cx(styles.row, className)} data-disabled={disabled || undefined}>
      <div className={styles.text}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className={styles.description}>
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        className={styles.track}
        data-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <m.span className={styles.thumb} layout transition={spring.snappy} />
      </button>
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<NoInfer<T>>[];
  onChange(value: NoInfer<T>): void;
  label: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  fullWidth,
}: SegmentedProps<T>) {
  const groupId = useId();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = options.findIndex((o) => o.value === value);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else return;
    event.preventDefault();
    onChange(options[next].value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons[next]?.focus();
  }

  return (
    <LayoutGroup id={groupId}>
      <div
        role="radiogroup"
        aria-label={label}
        className={cx(styles.segmented, size === "sm" && styles.segmentedSm, fullWidth && styles.segmentedFull)}
        onKeyDown={onKeyDown}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={styles.segment}
              data-selected={selected}
              onClick={() => onChange(option.value)}
            >
              {selected && <m.span layoutId="segment-indicator" className={styles.indicator} transition={spring.snappy} />}
              <span className={styles.segmentLabel}>
                {option.icon}
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
