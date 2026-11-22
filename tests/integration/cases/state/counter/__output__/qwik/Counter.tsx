import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
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
  CounterProps &
    CounterEvents &
    Omit<PropsOf<"div">, "initial" | "step" | "onChange$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ initial = 0, step = 1, onChange$, class: className, style, ...attributes }) => {
  const count = useSignal(initial);
  const doubled = useComputed$(() => count.value * 2);

  const increment = $(() => {
    count.value += step;
    onChange$?.(count.value);
  });

  return (
    <div class={["counter", className]} style={style} {...attributes}>
      <output>{count.value}</output>
      <>{doubled.value > 10 ? <span>Big</span> : null}</>
      <button type="button" onClick$={increment}>
        +{step}
      </button>
    </div>
  );
});
