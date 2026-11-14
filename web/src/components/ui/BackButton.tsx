import { ChevronLeft } from "lucide-react";
import styles from "./BackButton.module.css";

/** Back affordance for level-2 pages: a chevron plus the name of the page it returns to. */
export function BackButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className={styles.back} onClick={onClick} aria-label={`返回${label}`}>
      <ChevronLeft aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
