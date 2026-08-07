import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const ToastCtx = createContext(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((t) => {
    const id = ++idSeq;
    const toast = { id, kind: "info", timeoutMs: 4000, ...t };
    setToasts((xs) => [...xs, toast]);
    if (toast.timeoutMs > 0) {
      setTimeout(() => {
        setToasts((xs) => xs.filter((x) => x.id !== id));
      }, toast.timeoutMs);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const success = useCallback((msg, o = {}) => push({ kind: "success", message: msg, ...o }), [push]);
  const error = useCallback((msg, o = {}) => push({ kind: "error", message: msg, timeoutMs: 6000, ...o }), [push]);
  const info = useCallback((msg, o = {}) => push({ kind: "info", message: msg, ...o }), [push]);

  return (
    <ToastCtx.Provider value={{ push, dismiss, success, error, info, toasts }}>
      {children}
    </ToastCtx.Provider>
  );
}

function Icon({ kind }) {
  if (kind === "success") return <CheckCircle2 size={18} className="text-phos" />;
  if (kind === "error") return <AlertTriangle size={18} className="text-rose" />;
  return <Info size={18} className="text-ink-secondary" />;
}

export default function Toast() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      className="fixed top-0 inset-x-0 z-50 flex flex-col items-center pointer-events-none"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
      data-testid="toast-container"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto w-[92%] max-w-md mb-2 card flex items-start gap-3 p-3 shadow-card"
          data-testid={`toast-${t.kind}`}
        >
          <Icon kind={t.kind} />
          <div className="flex-1 min-w-0">
            {t.title && <div className="text-sm font-semibold text-ink-primary">{t.title}</div>}
            <div className="text-sm text-ink-secondary break-words">{t.message}</div>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-ink-tertiary hover:text-ink-secondary p-1 -m-1"
            aria-label="Dismiss"
            data-testid={`toast-dismiss-${t.id}`}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
