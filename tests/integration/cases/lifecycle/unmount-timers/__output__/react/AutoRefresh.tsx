import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

export interface AutoRefreshEvents {
  onRefresh?: (count: number) => void;
}

export default function AutoRefresh({ interval, onRefresh }: AutoRefreshProps & AutoRefreshEvents) {
  const onRefreshRef = useRef(onRefresh);
  useLayoutEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(enabled);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const refreshes = useRef(0);

  const [tick] = useState(() => () => {
    refreshes.current += 1;
    onRefreshRef.current?.(refreshes.current);
  });

  function toggle() {
    if (enabledRef.current) {
      clearInterval(timer.current);
      enabledRef.current = false;
      setEnabled(enabledRef.current);
    } else {
      timer.current = setInterval(tick, interval);
      enabledRef.current = true;
      setEnabled(enabledRef.current);
    }
  }

  const onUnmount = useEffectEvent(() => {
    clearInterval(timer.current);
  });
  useEffect(() => () => onUnmount(), []);

  return (
    <section className="auto-refresh" aria-label="Auto-refresh">
      <button type="button" aria-pressed={enabled} onClick={toggle}>
        Auto-refresh
      </button>
      <p role="status">{enabled ? "Refreshing" : "Paused"}</p>
    </section>
  );
}
