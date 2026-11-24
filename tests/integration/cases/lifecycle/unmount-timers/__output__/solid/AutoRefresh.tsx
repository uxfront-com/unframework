import {
  type ComponentProps,
  type JSX,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";

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
    Omit<ComponentProps<"section">, "interval" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["interval", "onRefresh", "class"]);

  const [enabled, setEnabled] = createSignal(false);
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

  onMount(() =>
    onCleanup(() => {
      clearInterval(timer);
    }),
  );

  return (
    <section
      class={props.class ? `auto-refresh ${props.class}` : "auto-refresh"}
      aria-label="Auto-refresh"
      {...others}
    >
      <button type="button" aria-pressed={enabled()} onClick={toggle}>
        Auto-refresh
      </button>
      <p role="status">{enabled() ? "Refreshing" : "Paused"}</p>
    </section>
  );
}
