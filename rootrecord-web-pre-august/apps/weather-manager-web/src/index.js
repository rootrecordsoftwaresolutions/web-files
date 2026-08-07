import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import AppErrorBoundary from './AppErrorBoundary';
import { safeLocalStorage } from './lib/storage';

function stashFatal(errLike) {
  try {
    const msg = errLike?.stack || errLike?.message || String(errLike);
    safeLocalStorage.setItem(
      'rrwm.lastFatal',
      JSON.stringify({ at: new Date().toISOString(), message: String(msg).slice(0, 4000) })
    );
  } catch {
    /* ignore */
  }
}

window.addEventListener('error', (e) => stashFatal(e?.error || e?.message || e));
window.addEventListener('unhandledrejection', (e) => stashFatal(e?.reason || e));

let el = document.getElementById('root');
if (!el) {
  el = document.createElement('div');
  el.id = 'root';
  document.body.appendChild(el);
}
const root = createRoot(el);
root.render(
  <HashRouter>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </HashRouter>
);
