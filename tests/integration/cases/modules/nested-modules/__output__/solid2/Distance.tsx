import { createState } from "./_unframework/createState";
import { formatDistance } from "./format";
import type { Unit } from "./units";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Distance(
  props: { value: number } & Omit<ComponentProps<"section">, "value" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "value", "class");

  const [unit, setUnit] = createState<Unit>("km");

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
