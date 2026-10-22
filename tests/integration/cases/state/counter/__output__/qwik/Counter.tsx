import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange$?: QRL<(value: number) => void>;
}

export default component$<
  CounterProps & CounterEvents & { class?: ClassList; style?: CSSProperties }
>(({ initial = 0, step = 1, onChange$, class: className, style, ...attributes }) => {
  const count = useSignal(initial);
  const doubled = useComputed$(() => count.value * 2);

  const increment = $(() => {
    count.value += step;
    onChange$?.(count.value);
  });

  return (
    <div class={["counter", className]} {...scopeAttributes(attributes)} style={style}>
      <output>{count.value}</output>
      <>{doubled.value > 10 ? <span>Big</span> : null}</>
      <button type="button" onClick$={increment}>
        +{step}
      </button>
    </div>
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
