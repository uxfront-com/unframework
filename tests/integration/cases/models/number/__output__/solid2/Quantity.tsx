import { createState } from "./_unframework/createState";
import { modelText } from "./_unframework/modelText";
import type { ComponentProps, JSX } from "@solidjs/web";
import { untrack } from "solid-js";

export default function Quantity(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [count, setCount] = createState(2);
  const [volume, setVolume] = createState(5);

  return (
    <section aria-label="Order" {...props}>
      <input
        type="number"
        aria-label="Count"
        min="0"
        value={untrack(count)}
        ref={modelText(count, setCount, { number: true })}
      />
      <input
        type="range"
        aria-label="Volume"
        min="0"
        max="10"
        value={untrack(volume)}
        ref={modelText(volume, setVolume, { number: true })}
      />
      <output>
        Next: {count() + 1}, volume {volume() + 1}
      </output>
      <button type="button" onClick={() => setCount(10)}>
        Ten
      </button>
    </section>
  );
}
