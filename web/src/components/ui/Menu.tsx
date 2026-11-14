import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { AnimatePresence, m } from "motion/react";
import { cx } from "../../lib/cx";
import { popover } from "../../lib/motion";
import styles from "./Menu.module.css";

interface TriggerProps {
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick(): void;
  onKeyDown(event: KeyboardEvent<HTMLElement>): void;
}

interface MenuProps {
  trigger(props: TriggerProps, open: boolean): ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  placement?: "bottom" | "top";
  label: string;
  className?: string;
  width?: number;
}

const MenuContext = createContext<{ close(): void } | null>(null);

export function Menu({ trigger, children, align = "end", placement = "bottom", label, className, width }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [focusTarget, setFocusTarget] = useState<"first" | "last">("first");
  const triggerId = useId();
  const menuId = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) document.getElementById(triggerId)?.focus();
  }, [triggerId]);

  useEffect(() => {
    if (!open) return;
    const items = listRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]");
    const target = focusTarget === "first" ? items?.[0] : items?.[items.length - 1];
    target?.focus();

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, focusTarget]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setFocusTarget(event.key === "ArrowDown" ? "first" : "last");
      setOpen(true);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    } else if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      {trigger(
        {
          id: triggerId,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": open ? menuId : undefined,
          onClick: () => {
            setFocusTarget("first");
            setOpen((v) => !v);
          },
          onKeyDown: onTriggerKeyDown,
        },
        open,
      )}
      <AnimatePresence>
        {open && (
          <m.div
            ref={listRef}
            id={menuId}
            role="menu"
            aria-label={label}
            aria-labelledby={triggerId}
            className={styles.menu}
            data-align={align}
            data-placement={placement}
            style={{ width }}
            variants={popover}
            initial="initial"
            animate="animate"
            exit="exit"
            onKeyDown={onMenuKeyDown}
          >
            <MenuContext.Provider value={{ close: () => close(false) }}>{children}</MenuContext.Provider>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onSelect?(): void;
  danger?: boolean;
  hint?: ReactNode;
}

export function MenuItem({ icon, children, onSelect, danger, hint }: MenuItemProps) {
  const ctx = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={styles.item}
      data-danger={danger || undefined}
      onClick={() => {
        ctx?.close();
        onSelect?.();
      }}
    >
      {icon && <span className={styles.itemIcon} aria-hidden="true">{icon}</span>}
      <span className={styles.itemLabel}>{children}</span>
      {hint && <span className={styles.itemHint}>{hint}</span>}
    </button>
  );
}

export function MenuLink({
  icon,
  children,
  to,
  external,
}: {
  icon?: ReactNode;
  children: ReactNode;
  to: string;
  external?: boolean;
}) {
  const ctx = useContext(MenuContext);
  const content = (
    <>
      {icon && <span className={styles.itemIcon} aria-hidden="true">{icon}</span>}
      <span className={styles.itemLabel}>{children}</span>
    </>
  );
  if (external) {
    return (
      <a role="menuitem" tabIndex={-1} className={styles.item} href={to} target="_blank" rel="noreferrer" onClick={() => ctx?.close()}>
        {content}
      </a>
    );
  }
  return (
    <Link role="menuitem" tabIndex={-1} className={styles.item} to={to} onClick={() => ctx?.close()}>
      {content}
    </Link>
  );
}

export function MenuSeparator() {
  return <div role="separator" className={styles.separator} />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}
