import { useEffect, useRef, useState } from "react";

type Burst = {
  id: number;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  coins: { id: number; dx: number; dy: number; delay: number; size: number }[];
};

let nextBurstId = 1;

/**
 * Renders a one-shot RU coin flight from `originRef` to `targetRef` whenever
 * `trigger` increments. Visual only — does not touch game logic.
 */
export function HarvestBurst({
  trigger,
  originRef,
  targetRef,
  count = 14,
}: {
  trigger: number;
  originRef: React.RefObject<HTMLElement>;
  targetRef: React.RefObject<HTMLElement>;
  count?: number;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seen = useRef(trigger);

  useEffect(() => {
    if (trigger === seen.current) return;
    seen.current = trigger;
    const origin = originRef.current?.getBoundingClientRect();
    const target = targetRef.current?.getBoundingClientRect();
    if (!origin || !target) return;

    const originX = origin.left + origin.width / 2;
    const originY = origin.top + origin.height / 2;
    const targetX = target.left + target.width / 2;
    const targetY = target.top + target.height / 2;

    const coins = Array.from({ length: count }, (_, i) => ({
      id: i,
      dx: targetX - originX + (Math.random() * 24 - 12),
      dy: targetY - originY + (Math.random() * 18 - 9),
      delay: Math.random() * 220,
      size: 0.75 + Math.random() * 0.55,
    }));

    const burst: Burst = {
      id: nextBurstId++,
      originX,
      originY,
      targetX,
      targetY,
      coins,
    };
    setBursts((prev) => [...prev, burst]);

    const timeout = window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burst.id));
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [trigger, originRef, targetRef, count]);

  if (bursts.length === 0) return null;

  return (
    <div className="harvest-burst" aria-hidden>
      {bursts.map((b) => (
        <div key={b.id}>
          <div
            className="harvest-ring"
            style={{ left: b.originX, top: b.originY }}
          />
          {b.coins.map((coin) => (
            <div
              key={coin.id}
              className="harvest-coin"
              style={{
                left: b.originX - 11,
                top: b.originY - 11,
                animationDelay: `${coin.delay}ms`,
                ["--sx" as any]: "0px",
                ["--sy" as any]: "0px",
                ["--ex" as any]: `${coin.dx}px`,
                ["--ey" as any]: `${coin.dy}px`,
                transform: `scale(${coin.size})`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
