import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

export interface AutoRefreshEvents {
  onRefresh?: (count: number) => void;
}

export interface AutoRefreshAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function AutoRefresh({
  interval,
  onRefresh,
  className,
  style,
  ...attributes
}: AutoRefreshProps & AutoRefreshEvents & AutoRefreshAttributes) {
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
    <section
      className={cx("auto-refresh", className)}
      aria-label="Auto-refresh"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button type="button" aria-pressed={enabled} onClick={toggle}>
        Auto-refresh
      </button>
      <p role="status">{enabled ? "Refreshing" : "Paused"}</p>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
