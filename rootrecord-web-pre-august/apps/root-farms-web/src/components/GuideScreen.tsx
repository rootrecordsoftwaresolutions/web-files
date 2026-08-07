export function GuideScreen() {
  return (
    <div className="screen guide-screen">
      <header className="guide-header">
        <h1>How Root Farms works</h1>
        <p className="guide-lead">
          A plain-language guide to growing crops, earning ROOTS, protecting your fields, using The Well, and comparing your balance with other players.
        </p>
      </header>

      <p className="guide-disclaimer" role="note">
        <strong>Please note:</strong> Game rules, income rates, costs, varmint behavior, Well limits, and other details may change at any time without notice. Dice is player-to-player and excluded from house-game limits. Wheel, roulette, and Hi-Lo currently cap bets at 0.1 ROOTS, cap payouts at 1 ROOT, and lock game play for 24 hours after 1 ROOT of rolling wins or losses in a 24-hour window.
      </p>

      <article className="guide-section">
        <h2>What is Root Farms?</h2>
        <p>
          Root Farms is a farming game tied to your Root Record account. You unlock crop plots, add rows, wait for crops to finish growing, and earn <strong>ROOTS</strong> — the same internal balance you see in your account and in Discord. The more active rows and bonus sources you run, the more you can earn over time.
        </p>
      </article>

      <article className="guide-section">
        <h2>Your balance</h2>
        <p>
          At the top of the game you see your <strong>available ROOTS</strong>. That number is your spendable internal Root Record balance, not a separate farm-only wallet.
        </p>
        <p>
          While crops are growing, part of your earnings may show as <strong>Pending Harvest</strong>. Use <strong>Harvest now</strong> to move that pending amount into your available balance. You can only harvest manually about once per minute. The game also settles earnings in the background when you play or return after being away.
        </p>
        <p>
          ROOTS display with decimals. The smallest unit shown by the game is <strong>0.00000001 ROOTS</strong>, matching the 8-decimal ROOTS token format used for future web-only token features.
        </p>
      </article>

      <article className="guide-section">
        <h2>Plots and rows</h2>
        <p>
          <strong>Roots</strong> are the main crop category. Each root plot is a type of crop (for example carrot, potato, onion, or another catalog entry). Plots start locked until you meet their unlock requirements.
        </p>
        <p>
          Inside a plot you add <strong>rows</strong>. Each row contributes to that plot&apos;s income. Rows have a growing cycle: when the cycle completes, you earn ROOTS for that harvest. Open a plot to see its grow time, harvest amount, and row limits.
        </p>
        <p>
          You spend ROOTS to unlock new plots and add more rows. Plan spending between expanding into new crops, deepening rows on crops you already run, and saving for The Well or later features.
        </p>
      </article>

      <article className="guide-section">
        <h2>Earning and income rate</h2>
        <p>
          Your farm produces income from multiple sources: <strong>Roots</strong>, <strong>Vegetables</strong>, purchased <strong>Root Cluster Trees</strong>, and active <strong>app trees</strong>. The top summary shows the total income rate for all sources plus a breakdown for roots, vegetables, trees, and apps.
        </p>
        <p>
          The income rate is shown as ROOTS per second. Harvest values show what each source pays when its cycle completes. Farmhands may reduce the rate while protection is active, while cluster trees and app trees can increase it.
        </p>
        <p>
          Income rates, grow times, unlock costs, and per-harvest payouts can be tuned as the game evolves. Always check your in-game screens for current numbers.
        </p>
      </article>

      <article className="guide-section">
        <h2>Farmhands (field protection)</h2>
        <p>
          The <strong>Farmhands</strong> tab is where you buy each helper&apos;s tool, then hire protection for your fields:
        </p>
        <ul className="guide-list">
          <li>
            <strong>Gopher protection</strong> — helps stop gophers from damaging a random active row on one of your plots.
          </li>
          <li>
            <strong>Field mice protection</strong> — helps stop mice from destroying an entire row (crop and slot).
          </li>
          <li>
            <strong>Rabbit protection</strong> — helps stop rabbits from clearing every row on a random plot. Rabbits attack less often than other varmints, but hurt more when they get through.
          </li>
          <li>
            <strong>Hire Uncle</strong> — Uncle swats at birds with his cane to keep flocks away from the whole field. This costs −10% income rate while active.
          </li>
        </ul>
        <p>
          The tool is a one-time purchase from your spendable balance. While a helper is <strong>on</strong>, your farm&apos;s <strong>income rate</strong> is reduced by that helper&apos;s percentage. You can toggle hired helpers anytime when signed in.
        </p>
        <p>
          Farmhand protection only counts as active if you have checked into Root Farms recently. If you have not opened Root Farms within about 48 hours, farmhands stop protecting until you return.
        </p>
      </article>

      <article className="guide-section">
        <h2>Storm Hazards</h2>
        <p>
          <strong>Ginger</strong> with at least two rows unlocks storm hazards. After that, <strong>wind</strong> and <strong>lightning</strong> are whole-field hazards: they can affect roots, vegetables, orchards, or cluster trees, not just Ginger+ plots. Buy the <strong>lightning rod</strong> to hire the <strong>lightning meteorologist</strong> (−1% income), or buy <strong>cypress saplings</strong> to enable the windbreak (−5% income, strong wind block).
        </p>
        <p>
          Varmints, birds, wind, and lightning can also affect orchard, vegetable, and cluster-tree progress as those systems grow. Read the Farmhands notifications after an alert so you know exactly what happened.
        </p>
      </article>

      <article className="guide-section">
        <h2>Orchards and vegetable plots</h2>
        <p>
          The <strong>Orchards</strong> tab contains three automatic app-bonus trees: Volcano, Business, and Weather. Each active tree adds +10% to total farm earnings for 24 hours after one signed-in session in its matching Root Record app.
        </p>
        <p>
          Purchased <strong>Root Cluster Trees</strong> also live in Orchards after you cluster a completed 10-plot root section. Each cluster tree adds +5% total income.
        </p>
        <p>
          Member-only trees live in Orchards too. Active monthly members grow a <strong>Monthly Member Tree</strong> for +10% income, while lifetime members grow a <strong>Lifetime Tree</strong> for +25% income.
        </p>
        <p>
          At <strong>farm level 20</strong>, <strong>Vegetable plots</strong> open as a separate tier with their own unlock and row costs. Farm level combines unlocked root and vegetable plots plus row progress. Vegetables are protected when you own the lightning meteorologist&apos;s rod and have at least one active farmhand.
        </p>
      </article>

      <article className="guide-section">
        <h2>The Well</h2>
        <p>
          <strong>The Well</strong> is the social and game table area for internal ROOTS. You can post dice requests for other farmers, spin the wheel, play roulette, try Hi-Lo, and make community donations.
        </p>
        <ul className="guide-list">
          <li>
            <strong>Dice requests</strong> — post a ROOTS stake up to 1 ROOT for another farmer to join. Higher D6 roll wins the escrowed stakes; ties refund both players. Dice is player-to-player, so it does not count toward the house-game rolling lock.
          </li>
          <li>
            <strong>Spin the wheel</strong> — costs 0.001 ROOTS per spin, has 100 visual pegs, and includes small prizes plus a rare 1 ROOT jackpot.
          </li>
          <li>
            <strong>Roulette</strong> — bet 0.001 to 0.1 ROOTS on red/black, odd/even, low/high, zero, or a straight number. Payouts are capped at 1 ROOT.
          </li>
          <li>
            <strong>Hi-Lo</strong> — start with one card face up, guess higher or lower, and keep going to grow the round bank by 1.95x per correct draw. Cash out anytime; a wrong guess loses the active bank, and the round bank maxes at 1 ROOT.
          </li>
          <li>
            <strong>Community donations</strong> — donate ROOTS to The Well and split the amount evenly across other signed-in farmers. Donations are recorded as internal ROOTS transactions and posted to the ROOTS economy webhook.
          </li>
          <li>
            <strong>Monthly membership pass</strong> — convert 150 ROOTS into a 30-day monthly membership pass so gameplay can activate the Monthly Member Tree.
          </li>
        </ul>
        <p>
          The wheel, roulette, and Hi-Lo are house-favored over time. Use them for fun, but do not spend ROOTS you need for farm upgrades. Across those house games, total rolling wins or losses of 1 ROOT in 24 hours locks Well games for 24 hours.
        </p>
      </article>

      <article className="guide-section">
        <h2>Varmints and notifications</h2>
        <p>
          Gophers, field mice, rabbits, and birds can attack farms across the game world on a schedule you do not control. When something happens to your farm, you may get a popup alert and an entry under Farmhands notifications.
        </p>
        <p>
          If the matching protection was on, the attack is blocked and you will see that in the message. If protection was off, you may lose rows or progress until you repair or replant as the game allows.
        </p>
      </article>

      <article className="guide-section">
        <h2>Welcome back</h2>
        <p>
          If you were away for a while, the game may show a <strong>welcome back</strong> summary when you return. It explains what happened while you were gone — earnings settled, attacks, or blocked attacks — so you can catch up quickly.
        </p>
      </article>

      <article className="guide-section">
        <h2>Root Economy</h2>
        <p>
          <strong>Root Economy</strong> shows a live leaderboard of top balances plus <strong>internal circulation</strong> — the total ROOTS held across linked accounts. Use <strong>/economy</strong> in Discord for the same summary. You can optionally set a <strong>public display name</strong> in your account settings on the Root Record website; otherwise the board shows a shortened wallet-style address. Discord usernames from your profile may appear when linked.
        </p>
        <p>This board is for fun and bragging rights — it does not change how your farm earns.</p>
      </article>

      <article className="guide-section">
        <h2>Mint Machine</h2>
        <p>
          <strong>Mint Machine</strong> is a coming-soon web-only feature for farm level 30. It is planned to let signed-in users mint eligible internal ROOTS balance to an on-chain address after the Solana switch is ready.
        </p>
        <p>
          Until it launches, Root Farms remains internal. The app-facing game does not require crypto activity.
        </p>
      </article>

      <article className="guide-section">
        <h2>Replant and Settings</h2>
        <p>
          <strong>Replant</strong> is planned for a future update (prestige-style resets with long-term bonuses). It is not available yet.
        </p>
        <p>
          <strong>Settings</strong> holds account-related options for the game shell. Sign-in uses your normal Root Record account; sign out here if you need to switch users on a shared device.
        </p>
      </article>

      <article className="guide-section guide-section--tips">
        <h2>Quick tips</h2>
        <ul className="guide-list">
          <li>Check pending harvest before spending your last ROOTS on upgrades or The Well.</li>
          <li>Balance row upgrades on your best plots with unlocking new crops.</li>
          <li>Cluster completed root sections to move them into Orchards and gain +5% total income per cluster tree.</li>
          <li>Open the Volcano, Business, and Weather apps once per day if you want the matching +10% app tree bonuses.</li>
          <li>Buy farmhand tools, then turn on protection when you cannot check the game often — weigh the income-rate reduction against hazard risk.</li>
          <li>Read Farmhands notifications after an alert so you know whether an attack was blocked.</li>
        </ul>
      </article>
    </div>
  );
}
