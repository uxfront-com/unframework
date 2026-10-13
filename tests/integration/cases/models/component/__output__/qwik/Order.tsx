import Stepper from "./Stepper";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const cups = useSignal(2);

    return (
      <section aria-label="Order" class={className} style={style}>
        <Stepper label="Cups" value={cups.value} onValueChange$={(value) => (cups.value = value)} />
        <output>Ordered: {cups.value}</output>
        <button type="button" onClick$={() => (cups.value = 0)}>
          Clear
        </button>
      </section>
    );
  },
);
