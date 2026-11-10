import { formatDistance } from "./format";
import type { Unit } from "./units";
import { type JSX, createSignal } from "solid-js";

export default function Distance(
  props: { value: number } & { class?: string; style?: JSX.CSSProperties },
) {
  const [unit, setUnit] = createSignal<Unit>("km");

  return (
    <section
      class={props.class ? `distance ${props.class}` : "distance"}
      aria-label="Distance"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">{formatDistance(props.value, unit())}</p>
      <button type="button" onClick={() => setUnit(unit() === "km" ? "mi" : "km")}>
        Switch units
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
