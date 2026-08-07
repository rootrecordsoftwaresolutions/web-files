import React from "react";

/**
 * Mobile-friendly bottom sheet overlay (full-width, scrollable body).
 * Click the dimmed backdrop to close.
 */
export function FullSheet({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 w-full h-full border-0 p-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[90vh] flex flex-col rounded-t-2xl border-t border-strong bg-bg-elevated shadow-2xl"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-subtle shrink-0">
          <h2 className="font-heading text-lg font-bold text-ink-primary truncate">{title}</h2>
          <button type="button" className="btn btn-ghost shrink-0" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
