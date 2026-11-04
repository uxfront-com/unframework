import { useControllableState } from "./useControllableState";
import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
} from "@qwik.dev/core";

export interface RatingEvents {
  onChange$?: QRL<(value: number) => void>;
}

export default component$<
  { value?: number } & RatingEvents & { class?: ClassList; style?: CSSProperties }
>(({ value, onChange$, class: className, style, ...attributes }) => {
  const { current, set } = useControllableState(
    useComputed$(() => value),
    1,
    $((next) => onChange$?.(next)),
  );

  return (
    <section
      class={["rating", className]}
      aria-label="Rating"
      {...scopeAttributes(attributes)}
      style={style}
    >
      <p role="status">Rated {current.value} of 3</p>
      <button type="button" onClick$={() => set(2)}>
        Two
      </button>
      <button type="button" onClick$={() => set(3)}>
        Three
      </button>
    </section>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
