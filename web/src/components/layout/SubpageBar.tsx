import type { ReactNode } from "react";
import { BackButton } from "../ui/BackButton";
import styles from "./SubpageBar.module.css";

/** Navigation bar for level-2 pages on touch layouts: back on the left, title centred. */
export function SubpageBar({
  title,
  backLabel,
  onBack,
  actions,
}: {
  title: string;
  backLabel: string;
  onBack(): void;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.bar}>
      <div className={styles.side}>
        <BackButton label={backLabel} onClick={onBack} />
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={`${styles.side} ${styles.end}`}>{actions}</div>
    </header>
  );
}
