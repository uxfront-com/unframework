import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

export interface AutoRefreshEvents {
  onRefresh$?: QRL<(count: number) => void>;
}

export default component$<
  AutoRefreshProps & AutoRefreshEvents & { class?: ClassList; style?: CSSProperties }
>(({ interval, onRefresh$, class: className, style, ...attributes }) => {
  const enabled = useSignal(false);
  const timer = useSignal<ReturnType<typeof setInterval> | undefined>();
  const refreshes = useSignal(0);

  const tick = $(() => {
    refreshes.value += 1;
    onRefresh$?.(refreshes.value);
  });

  const toggle = $(() => {
    if (enabled.value) {
      clearInterval(timer.value);
      enabled.value = false;
    } else {
      timer.value = setInterval(tick, interval);
      enabled.value = true;
    }
  });

  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => {
        clearInterval(timer.value);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <section
      class={["auto-refresh", className]}
      aria-label="Auto-refresh"
      {...scopeAttributes(attributes)}
      style={style}
    >
      <button type="button" aria-pressed={enabled.value} onClick$={toggle}>
        Auto-refresh
      </button>
      <p role="status">{enabled.value ? "Refreshing" : "Paused"}</p>
    </section>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
