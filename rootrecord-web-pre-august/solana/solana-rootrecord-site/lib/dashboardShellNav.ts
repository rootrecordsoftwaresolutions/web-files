/**
 * Persistent left navigation for the dashboard shell (`app/(app-shell)`).
 * URLs stay the same; only the filesystem route group changes.
 */
import { TOOL_CATALOG } from '@/lib/toolsCatalog';

export type ShellNavItem = { href: string; label: string };

export type ShellNavGroup = {
  heading: string;
  items: ShellNavItem[];
};

function navTrimTitle(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  return t.length <= 34 ? t : `${t.slice(0, 32)}…`;
}

function buildToolsNavItems(): ShellNavItem[] {
  const items: ShellNavItem[] = [{ href: '/tools', label: 'All tools' }];
  for (const e of TOOL_CATALOG) {
    if ('href' in e && e.href === '/bulk') continue;
    if ('href' in e) {
      items.push({ href: e.href, label: navTrimTitle(e.title) });
    } else {
      items.push({
        href: `/tools?tool=${encodeURIComponent(e.kind)}`,
        label: navTrimTitle(e.title),
      });
    }
  }
  return items;
}

/** Full sidebar: every tool under Tools (used off the Hub). */
export const DASHBOARD_SHELL_NAV: ShellNavGroup[] = [
  {
    heading: 'Overview',
    items: [{ href: '/dashboard', label: 'Hub' }],
  },
  {
    heading: 'Build',
    items: [{ href: '/create', label: 'Create token' }],
  },
  {
    heading: 'Tools',
    items: buildToolsNavItems(),
  },
  {
    heading: 'Distribute',
    items: [
      { href: '/bulk', label: 'Bulk SOL & SPL sends' },
      { href: '/wallet-generator', label: 'Paper wallet' },
    ],
  },
  {
    heading: 'Discover',
    items: [
      { href: '/recent-tokens', label: 'New tokens' },
      { href: '/token-stats', label: 'Token stats' },
    ],
  },
  {
    heading: 'Program',
    items: [
      { href: '/contracts', label: 'Contracts' },
      { href: '/contracts/vesting', label: 'Vesting' },
      { href: '/referrals', label: 'Referrals' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/operations', label: 'Operations' },
    ],
  },
  {
    heading: 'You',
    items: [
      { href: '/account', label: 'Account' },
      { href: '/account/signup', label: 'Sign up' },
      { href: '/my-actions', label: 'My actions' },
    ],
  },
];

/**
 * Sidebar for the current route. On Hub (`/dashboard`) the Tools group is only “All tools” so
 * the page is not a wall of links; individual tools stay in the full nav everywhere else.
 */
export function getDashboardShellNav(pathname: string): ShellNavGroup[] {
  const onHub = pathname === '/dashboard';
  if (!onHub) return DASHBOARD_SHELL_NAV;
  return DASHBOARD_SHELL_NAV.map((group) =>
    group.heading === 'Tools'
      ? { ...group, items: [{ href: '/tools', label: 'All tools' }] }
      : group,
  );
}

/** In-page sections on `/dashboard` (hash links). Empty — Hub is a single short screen. */
export const DASHBOARD_HUB_ANCHORS: { hash: string; label: string }[] = [];
