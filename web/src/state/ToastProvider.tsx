import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastViewport } from "../components/ui/ToastViewport";
import { ToastContext, type ToastContextValue, type ToastItem, type ToastOptions, type ToastTone } from "./toast";

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, message: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      setItems((current) => [...current, { id, tone, message, action: options.action }].slice(-MAX_VISIBLE));
      const duration = options.duration ?? (options.action ? 6000 : tone === "error" ? 5200 : 3600);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (m, o) => show("success", m, o),
      error: (m, o) => show("error", m, o),
      info: (m, o) => show("info", m, o),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
