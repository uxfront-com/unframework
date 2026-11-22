import { useControllableState } from "./useControllableState";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface RatingEvents {
  onChange?: (value: number) => void;
}

export default function Rating(
  props: { value?: number } & RatingEvents &
    Omit<ComponentProps<"section">, "value" | "onChange" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["value", "onChange", "class"]);

  const { current, set } = useControllableState(
    () => props.value,
    1,
    (next) => props.onChange?.(next),
  );

  return (
    <section
      class={props.class ? `rating ${props.class}` : "rating"}
      aria-label="Rating"
      {...others}
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
