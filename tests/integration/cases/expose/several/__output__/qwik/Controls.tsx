import Counter from "./Counter";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const counter = useSignal<{ increment(): void; reset(): void }>();

    return (
      <div class={["controls", className]} style={style}>
        <Counter ref={counter} start={10} />
        <button type="button" onClick$={() => counter.value?.increment()}>
          More
        </button>
        <button type="button" onClick$={() => counter.value?.reset()}>
          Reset
        </button>
      </div>
    );
  },
);
