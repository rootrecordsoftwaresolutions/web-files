import React from "react";

export default function PageHeader({ title, subtitle, right, testid = "page-header" }) {
  return (
    <header
      className="sticky top-0 z-20 backdrop-blur-xl bg-bg-base/75 border-b border-white/5"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      data-testid={testid}
    >
      <div className="page-shell px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-ink-primary truncate">{title}</h1>
          {subtitle && (
            <div className="text-[11px] uppercase tracking-widest text-ink-tertiary mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
