import { useControllableState } from "./useControllableState";
import type { JSX } from "solid-js";

export interface RatingEvents {
  onChange?: (value: number) => void;
}

export default function Rating(
  props: { value?: number } & RatingEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const { current, set } = useControllableState(
    () => props.value,
    1,
    (next) => props.onChange?.(next),
  );

  return (
    <section
      class={props.class ? `rating ${props.class}` : "rating"}
      aria-label="Rating"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">Rated {current()} of 3</p>
      <button type="button" onClick={() => set(2)}>
        Two
      </button>
      <button type="button" onClick={() => set(3)}>
        Three
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
