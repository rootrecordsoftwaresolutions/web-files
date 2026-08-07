import type { Metadata } from 'next';
import Link from 'next/link';

import { OperationsWikiLayout } from '@/components/operations/OperationsWikiLayout';
import { pageSeo, SEO_KEYWORDS } from '@/lib/seo';

export const metadata: Metadata = pageSeo({
  path: '/operations/liquidity-timing',
  title: 'Liquidity timing — RRTT',
  description:
    'When treasury liquidity checks run (UTC), what they protect, and how to verify balances on-chain — in plain language.',
  keywords: [
    ...SEO_KEYWORDS.core,
    'RRTT',
    'treasury',
    'liquidity',
    'Raydium',
    'automation',
  ],
});

export default function LiquidityTimingPage() {
  return (
    <OperationsWikiLayout>
      <div className="space-y-10 text-sm leading-relaxed text-muted-foreground md:text-base">
        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            Why this runs on a schedule
          </h2>
          <p>
            Raydium pools and Solana itself can get busy. Spreading automated treasury work across
            the hour avoids stacking everything at once and keeps maintenance separate from normal
            site traffic. <strong className="text-foreground">All times below are UTC.</strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            Short heartbeat, two real checkpoints
          </h2>
          <p>
            RootRecord’s backend wakes up on a <strong className="text-foreground">short, steady cadence</strong>{' '}
            (about every five minutes). Most passes only do lightweight housekeeping. For treasury
            liquidity, <strong className="text-foreground">only two minutes each hour matter</strong>:{' '}
            <strong className="text-foreground">:00</strong> and <strong className="text-foreground">:10</strong>{' '}
            after the hour. That pattern keeps Raydium-related treasury work predictable instead of
            firing on random clicks or page loads.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            :00 — keep enough SOL for fees and operations
          </h2>
          <p>
            The treasury wallet needs native SOL to pay network fees and to sponsor custodial
            flows. If SOL slips below an internal “keep this much on hand” floor (the exact number is
            set per deployment), automation moves value out of the treasury’s{' '}
            <strong className="text-foreground">SOL-side Raydium pool</strong> by redeeming pool
            shares, then converts wrapped SOL back to plain SOL where the tooling allows. If the
            wiring for that pool is missing, the run logs a clear skip reason instead of taking down
            unrelated jobs.
          </p>
          <p>
            <strong className="text-foreground">Net effect:</strong> when SOL is tight, depth in
            that pool is traded for spendable SOL on the treasury until the floor is restored.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            :10 — keep enough RRTT and reserve inventory
          </h2>
          <p>
            Some programs expect the treasury to hold minimum balances of RRTT and the paired
            reserve token. If either balance is short, automation frees tokens from the treasury’s{' '}
            <strong className="text-foreground">RRTT / reserve Raydium pool</strong> the same way:
            redeem pool shares, move underlying tokens back to the treasury. If that still is not
            enough, an <strong className="text-foreground">optional backup wallet</strong> (only when
            configured) can move inventory into the treasury. Persistent problems can surface in
            operator alerts when those channels exist.
          </p>
          <p>
            <strong className="text-foreground">Net effect:</strong> SPL inventory is topped up from
            pool depth (and, if needed, from a maintenance wallet) before user-facing jobs need
            those tokens—without tying the process to someone sitting at a browser.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            Not the same as daily reward settlement
          </h2>
          <p>
            A <strong className="text-foreground">separate once-a-day</strong> pass can move earned
            RRTT into hosted wallets and refresh a small SOL cushion on those accounts so sponsored
            withdrawals still work. That schedule answers “when does my reward land,” not “how is
            Raydium depth topped up.”
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground md:text-2xl">
            How to double-check what really happened
          </h2>
          <p>
            Explorers beat prose: balances, pool addresses, and transaction history reflect what is
            live right now. This page explains <strong className="text-foreground">intent and timing</strong>;{' '}
            if anything disagrees with the chain, trust the chain.
          </p>
          <p>
            For pool addresses, reserve accounting, and the bigger token map, see{' '}
            <Link href="/operations/tokenomics" className="text-sol-green underline-offset-4 hover:underline">
              Tokenomics &amp; markets
            </Link>
            .
          </p>
        </section>
      </div>
    </OperationsWikiLayout>
  );
}
