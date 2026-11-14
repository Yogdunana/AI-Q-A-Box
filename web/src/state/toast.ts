import { createContext, useContext } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onAction: () => void };
}

export interface ToastOptions {
  action?: ToastItem["action"];
  duration?: number;
}

export interface ToastContextValue {
  show(tone: ToastTone, message: string, options?: ToastOptions): number;
  success(message: string, options?: ToastOptions): number;
  error(message: string, options?: ToastOptions): number;
  info(message: string, options?: ToastOptions): number;
  dismiss(id: number): void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
