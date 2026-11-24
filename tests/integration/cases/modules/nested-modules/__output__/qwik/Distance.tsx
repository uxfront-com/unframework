import { formatDistance } from "./format";
import type { Unit } from "./units";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  { value: number } & Omit<PropsOf<"section">, "value" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ value, class: className, style, ...attributes }) => {
  const unit = useSignal<Unit>("km");

  return (
    <section class={["distance", className]} aria-label="Distance" style={style} {...attributes}>
      <p role="status">{formatDistance(value, unit.value)}</p>
      <button type="button" onClick$={() => (unit.value = unit.value === "km" ? "mi" : "km")}>
        Switch units
      </button>
    </section>
  );
});
