import PriceRange from "./PriceRange";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Search(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [low, setLow] = createState(20);
  const [high, setHigh] = createState(50);

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
