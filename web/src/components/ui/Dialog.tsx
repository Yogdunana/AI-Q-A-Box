import { useEffect, useEffectEvent, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import { cx } from "../../lib/cx";
import { useMediaQuery } from "../../lib/hooks";
import { duration, ease, spring } from "../../lib/motion";
import { Button, IconButton, type ButtonVariant } from "./Button";
import styles from "./Dialog.module.css";

interface DialogProps {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
  initialFocus?: RefObject<HTMLElement | null>;
  /** Prevent closing via Escape / backdrop, e.g. while a request is in flight. */
  dismissible?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog(props: DialogProps) {
  return createPortal(
    <AnimatePresence>{props.open && <DialogPanel key="dialog" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function DialogPanel({
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
  initialFocus,
  dismissible = true,
}: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const sheet = !useMediaQuery("(min-width: 640px)");
  const onEscape = useEffectEvent(() => {
    if (dismissible) onClose();
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target?.focus({ preventScroll: true });

    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [initialFocus]);

  return (
    <div className={styles.root}>
      <m.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: duration.base, ease: ease.out } }}
        exit={{ opacity: 0, transition: { duration: duration.fast, ease: ease.in } }}
        onClick={() => dismissible && onClose()}
        aria-hidden="true"
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(styles.panel, styles[size], sheet && styles.sheet)}
        initial={sheet ? { y: "100%" } : { opacity: 0, scale: 0.97, y: 8 }}
        animate={
          sheet
            ? { y: 0, transition: spring.gentle }
            : { opacity: 1, scale: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }
        }
        exit={
          sheet
            ? { y: "100%", transition: { duration: duration.base, ease: ease.in } }
            : { opacity: 0, scale: 0.98, transition: { duration: duration.fast, ease: ease.in } }
        }
      >
        {sheet && <span className={styles.grabber} aria-hidden="true" />}
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {dismissible && (
            <IconButton label="关闭" size="sm" onClick={onClose} className={styles.close}>
              <X />
            </IconButton>
          )}
        </div>
        {description && (
          <p id={descId} className={styles.description}>
            {description}
          </p>
        )}
        {children && <div className={styles.body}>{children}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </m.div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  loading?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "取消",
  variant = "primary",
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      initialFocus={variant === "danger" ? cancelRef : undefined}
      dismissible={!loading}
      footer={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
