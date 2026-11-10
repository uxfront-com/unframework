import { formatDistance } from "./format";
import type { Unit } from "./units";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ value: number } & { class?: ClassList; style?: CSSProperties }>(
  ({ value, class: className, style, ...attributes }) => {
    const unit = useSignal<Unit>("km");

    return (
      <section
        class={["distance", className]}
        aria-label="Distance"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">{formatDistance(value, unit.value)}</p>
        <button type="button" onClick$={() => (unit.value = unit.value === "km" ? "mi" : "km")}>
          Switch units
        </button>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
