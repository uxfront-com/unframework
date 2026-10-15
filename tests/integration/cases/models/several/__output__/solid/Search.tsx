import PriceRange from "./PriceRange";
import { type JSX, createSignal } from "solid-js";

export default function Search(props: { class?: string; style?: JSX.CSSProperties }) {
  const [low, setLow] = createSignal(20);
  const [high, setHigh] = createSignal(50);

  return (
    <section aria-label="Search" class={props.class} style={props.style}>
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
