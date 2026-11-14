import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import styles from "./Page.module.css";

export function Page({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: "default" | "narrow";
  className?: string;
}) {
  return <div className={cx(styles.page, width === "narrow" && styles.narrow, className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  children,
  aside,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <section className={styles.section} aria-labelledby={id ? `${id}-title` : undefined} id={id}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={id ? `${id}-title` : undefined} className={styles.sectionTitle}>
            {title}
          </h2>
          {description && <p className={styles.sectionDescription}>{description}</p>}
        </div>
        {aside}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cx(styles.card, padded && styles.cardPadded, className)}>{children}</div>;
}
