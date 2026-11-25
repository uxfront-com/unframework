import { modelText } from "./_unframework/modelText";
import { type ComponentProps, type JSX, createSignal, untrack } from "solid-js";

export default function Quantity(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [count, setCount] = createSignal(2);
  const [volume, setVolume] = createSignal(5);

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
