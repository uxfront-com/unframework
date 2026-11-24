import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit, onSettled } from "solid-js";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

export interface AutoRefreshEvents {
  onRefresh?: (count: number) => void;
}

export default function AutoRefresh(
  props: AutoRefreshProps &
    AutoRefreshEvents &
    Omit<ComponentProps<"section">, "interval" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "interval", "onRefresh", "class");

  const [enabled, setEnabled] = createState(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let refreshes = 0;

  function tick() {
    refreshes += 1;
    props.onRefresh?.(refreshes);
  }

  function toggle() {
    if (enabled()) {
      clearInterval(timer);
      setEnabled(false);
    } else {
      timer = setInterval(tick, props.interval);
      setEnabled(true);
    }
  }

  onSettled(() => () => {
    clearInterval(timer);
  });

  return (
    <section
      class={props.class ? `auto-refresh ${props.class}` : "auto-refresh"}
      aria-label="Auto-refresh"
      {...others}
    >
      <button type="button" aria-pressed={enumeratedValue(enabled())} onClick={toggle}>
        Auto-refresh
      </button>
      <p role="status">{enabled() ? "Refreshing" : "Paused"}</p>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
