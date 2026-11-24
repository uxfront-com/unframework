import { useCounter } from "./useCounter";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface ClickerEvents {
  onLimit$?: QRL<(count: number) => void>;
}

export default component$<
  ClickerEvents &
    Omit<PropsOf<"section">, "onLimit$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ onLimit$, class: className, style, ...attributes }) => {
  const message = useSignal("Keep going");
  const { count, step, increment, reset } = useCounter(
    3,
    $((reached) => {
      message.value = `Reached ${reached}`;
      onLimit$?.(reached);
    }),
  );

  return (
    <section class={["clicker", className]} aria-label="Clicker" style={style} {...attributes}>
      <p role="status">Count: {count.value}</p>
      <p>{message.value}</p>
      <button type="button" onClick$={() => increment()}>
        Add {step}
      </button>
      <button type="button" onClick$={() => reset()}>
        Reset
      </button>
    </section>
  );
});
