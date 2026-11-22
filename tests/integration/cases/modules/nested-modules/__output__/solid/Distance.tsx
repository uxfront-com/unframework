import { formatDistance } from "./format";
import type { Unit } from "./units";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function Distance(
  props: { value: number } & Omit<ComponentProps<"section">, "value" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["value", "class"]);

  const [unit, setUnit] = createSignal<Unit>("km");

  return (
    <section
      class={props.class ? `distance ${props.class}` : "distance"}
      aria-label="Distance"
      {...others}
    >
      <p role="status">{formatDistance(props.value, unit())}</p>
      <button type="button" onClick={() => setUnit(unit() === "km" ? "mi" : "km")}>
        Switch units
      </button>
    </section>
  );
}
