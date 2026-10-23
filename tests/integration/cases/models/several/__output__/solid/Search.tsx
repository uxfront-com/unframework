import PriceRange from "./PriceRange";
import { type JSX, createSignal } from "solid-js";

export default function Search(props: { class?: string; style?: JSX.CSSProperties }) {
  const [low, setLow] = createSignal(20);
  const [high, setHigh] = createSignal(50);

  return (
    <section
      aria-label="Search"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
