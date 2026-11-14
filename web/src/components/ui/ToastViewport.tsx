import { AnimatePresence, m } from "motion/react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import type { ToastItem } from "../../state/toast";
import { duration, ease, spring } from "../../lib/motion";
import styles from "./Toast.module.css";

const ICONS = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
};

export function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss(id: number): void }) {
  return (
    <section className={styles.viewport} aria-label="通知">
      <ol className={styles.list}>
        <AnimatePresence initial={false}>
          {items.map((toast) => {
            const Icon = ICONS[toast.tone];
            return (
              <m.li
                key={toast.id}
                layout
                className={styles.toast}
                data-tone={toast.tone}
                role={toast.tone === "error" ? "alert" : "status"}
                aria-live={toast.tone === "error" ? "assertive" : "polite"}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring.gentle, opacity: { duration: duration.fast } } }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: duration.fast, ease: ease.in } }}
              >
                <Icon className={styles.icon} aria-hidden="true" />
                <p className={styles.message}>{toast.message}</p>
                {toast.action && (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => {
                      toast.action!.onAction();
                      onDismiss(toast.id);
                    }}
                  >
                    {toast.action.label}
                  </button>
                )}
                <button type="button" className={styles.close} aria-label="关闭通知" onClick={() => onDismiss(toast.id)}>
                  <X aria-hidden="true" />
                </button>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </section>
  );
}
