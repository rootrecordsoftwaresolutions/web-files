import React from 'react';
import { safeLocalStorage } from './lib/storage';

/**
 * Catches render errors so a single bad API shape doesn't blank the whole WebView.
 * No stack traces — only a reload affordance.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    try {
      // eslint-disable-next-line no-console
      console.error('AppErrorBoundary', err);
    } catch {
      /* ignore */
    }
    try {
      safeLocalStorage.setItem(
        'rrwm.lastReactError',
        JSON.stringify({
          at: new Date().toISOString(),
          message: String(err?.message || err).slice(0, 2000),
          stack: String(err?.stack || '').slice(0, 4000),
        })
      );
    } catch {
      /* ignore */
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          className="min-h-screen bg-app flex flex-col items-center justify-center p-8 text-center"
          data-testid="app-error-boundary"
        >
          <h1 className="text-xl font-semibold text-white tracking-tight">Weather Manager</h1>
          <p className="text-sm text-accent/75 mt-3 max-w-xs leading-relaxed">
            Something went wrong loading this screen. Your data is unchanged — try reloading.
          </p>
          <button
            type="button"
            className="mt-8 px-8 py-3 rounded-sm bg-accent text-app font-semibold text-sm active:scale-[.98]"
            onClick={() => {
              try {
                window.location.reload();
              } catch {
                /* ignore */
              }
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
