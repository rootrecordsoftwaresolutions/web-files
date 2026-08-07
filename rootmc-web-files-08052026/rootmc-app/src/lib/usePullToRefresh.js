import { useEffect, useRef, useState } from "react";

/**
 * Mobile-first pull-to-refresh hook.
 * Wraps the top-most scroll container. When scrollTop === 0 and the user drags down
 * past a threshold, onRefresh() is invoked and the visual indicator is shown.
 *
 * Usage:
 *   const { bind, refreshing, pullDist } = usePullToRefresh(async () => {
 *     await Promise.all([...]);
 *   });
 *   return <div {...bind}>{...}</div>
 */
export function usePullToRefresh(onRefresh, threshold = 72) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDist, setPullDist] = useState(0);
  const startY = useRef(null);
  const active = useRef(false);

  const onTouchStart = (e) => {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  };

  const onTouchMove = (e) => {
    if (!active.current || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY <= 0) {
      const d = Math.min(dy * 0.5, threshold * 1.5);
      setPullDist(d);
    } else {
      setPullDist(0);
    }
  };

  const onTouchEnd = async () => {
    if (!active.current) return;
    active.current = false;
    if (pullDist >= threshold && !refreshing) {
      setRefreshing(true);
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setPullDist(0);
      }
    } else {
      setPullDist(0);
    }
    startY.current = null;
  };

  useEffect(() => {
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDist, refreshing]);

  return { refreshing, pullDist, threshold };
}
