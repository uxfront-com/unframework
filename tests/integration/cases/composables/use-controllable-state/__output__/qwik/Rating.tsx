import { useControllableState } from "./useControllableState";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useComputed$,
} from "@qwik.dev/core";

export interface RatingEvents {
  onChange$?: QRL<(value: number) => void>;
}

export default component$<
  { value?: number } & RatingEvents &
    Omit<PropsOf<"section">, "value" | "onChange$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ value, onChange$, class: className, style, ...attributes }) => {
  const { current, set } = useControllableState(
    useComputed$(() => value),
    1,
    $((next) => onChange$?.(next)),
  );

  return (
    <section class={["rating", className]} aria-label="Rating" style={style} {...attributes}>
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
