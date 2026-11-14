import type { CSSProperties, ReactNode } from "react";
import { m } from "motion/react";
import type { QuestionStatus } from "../../api/types";
import { avatarTint, initialOf } from "../../lib/format";
import { cx } from "../../lib/cx";
import { fadeUp } from "../../lib/motion";
import { STATUS_META } from "../../lib/status";
import styles from "./Display.module.css";

export function StatusBadge({ status, plain }: { status: QuestionStatus; plain?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <span className={styles.badge} data-tone={meta.tone} data-plain={plain || undefined}>
      <span className={styles.dot} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  const tint = avatarTint(name);
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, background: tint.bg, color: tint.fg, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : initialOf(name)}
    </span>
  );
}

export function Skeleton({
  width = "100%",
  height = 12,
  radius,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(styles.skeleton, className)}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "danger";
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, body, actions, tone = "default", compact, className }: EmptyStateProps) {
  return (
    <m.div
      className={cx(styles.empty, compact && styles.emptyCompact, className)}
      variants={fadeUp}
      initial="initial"
      animate="animate"
      role={tone === "danger" ? "alert" : undefined}
    >
      <span className={styles.emptyIcon} data-tone={tone} aria-hidden="true">
        {icon}
      </span>
      <h2 className={styles.emptyTitle}>{title}</h2>
      {body && <p className={styles.emptyBody}>{body}</p>}
      {actions && <div className={styles.emptyActions}>{actions}</div>}
    </m.div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
