import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Activity, Haze, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from '../lib/format';

const tabs = [
  { to: '/', label: 'Home', icon: Home, testId: 'tab-home' },
  { to: '/hazards', label: 'Hazards', icon: Activity, testId: 'tab-hazards' },
  { to: '/air-quality', label: 'Air', icon: Haze, testId: 'tab-air-quality' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, testId: 'tab-settings' },
];

function navLinkClass(isActive) {
  return clsx(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-subtle text-accent shadow-sm'
      : 'text-white/70 hover:bg-container/80 hover:text-white'
  );
}

function NavIcon({ Icon, isActive }) {
  return <Icon strokeWidth={isActive ? 2 : 1.5} className="h-5 w-5 shrink-0" />;
}

/** Mobile: bottom tabs. Desktop (lg+): fixed left rail — web-first workflow layout. */
export default function TabBar() {
  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-subtle bg-app/95 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:flex"
        aria-label="Main navigation"
      >
        <div className="px-4 pb-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/90">RootRecord</div>
          <div className="mt-0.5 text-sm font-semibold text-white">Weather</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-4">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              data-testid={`${t.testId}-side`}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <NavIcon Icon={t.icon} isActive={isActive} />
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-subtle bg-app/90 backdrop-blur-xl lg:hidden"
        style={{
          height: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        data-testid="bottom-tab-bar"
      >
        <ul className="grid h-full grid-cols-4">
          {tabs.map((t) => (
            <li key={t.to} className="flex">
              <NavLink
                to={t.to}
                end={t.to === '/'}
                data-testid={t.testId}
                className={({ isActive }) =>
                  clsx(
                    'flex w-full flex-col items-center justify-center gap-1 transition-colors active:scale-95',
                    isActive ? 'text-accent' : 'text-accent/60 hover:text-accent'
                  )
                }
              >
                <t.icon strokeWidth={1.5} className="h-6 w-6" />
                <span className="font-mono text-[10px] uppercase tracking-widest">{t.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
