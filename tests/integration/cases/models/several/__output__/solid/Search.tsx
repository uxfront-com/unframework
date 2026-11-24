import PriceRange from "./PriceRange";
import { type ComponentProps, type JSX, createSignal } from "solid-js";

export default function Search(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [low, setLow] = createSignal(20);
  const [high, setHigh] = createSignal(50);

  return (
    <section aria-label="Search" {...props}>
      <PriceRange
        label="Price"
        min={low()}
        onMinChange={setLow}
        max={high()}
        onMaxChange={setHigh}
      />
      <output>
        Between {low()} and {high()}
      </output>
      <button type="button" onClick={() => setHigh(40)}>
        Cheaper
      </button>
    </section>
  );
}
