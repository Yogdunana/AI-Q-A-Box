import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { cx } from "../../lib/cx";
import { Spinner } from "./Spinner";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "ai";
export type ButtonSize = "sm" | "md" | "lg";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

export interface ButtonProps extends CommonProps, ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

function classes({ variant = "secondary", size = "md", fullWidth }: CommonProps, className?: string) {
  return cx(styles.button, styles[variant], styles[size], fullWidth && styles.full, className);
}

function Content({ leadingIcon, trailingIcon, children }: CommonProps & { children?: ReactNode }) {
  return (
    <span className={styles.label}>
      {leadingIcon && <span className={styles.icon} aria-hidden="true">{leadingIcon}</span>}
      {children}
      {trailingIcon && <span className={styles.icon} aria-hidden="true">{trailingIcon}</span>}
    </span>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, leadingIcon, trailingIcon, fullWidth, loading, disabled, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes({ variant, size, fullWidth }, className)}
      disabled={disabled || loading}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </Content>
      {loading && (
        <span className={styles.spinner}>
          <Spinner size={size === "lg" ? 18 : 16} />
        </span>
      )}
    </button>
  );
});

export interface ButtonLinkProps extends CommonProps, LinkProps {}

export function ButtonLink({
  variant,
  size,
  leadingIcon,
  trailingIcon,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, fullWidth }, className)} {...rest}>
      <Content leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, size === "sm" && styles.iconButtonSm, className)}
      {...rest}
    >
      {children}
    </button>
  );
});
