import { cx } from "./_unframework/cx";
import { useControllableState } from "./useControllableState";
import type { ComponentPropsWithRef } from "react";

export interface RatingEvents {
  onChange?: (value: number) => void;
}

export type RatingAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "value" | "onChange" | "children"
>;

export default function Rating({
  value,
  onChange,
  className,
  style,
  ...attributes
}: { value?: number } & RatingEvents & RatingAttributes) {
  const { current, set } = useControllableState(
    () => value,
    1,
    (next) => onChange?.(next),
  );

  return (
    <section className={cx("rating", className)} aria-label="Rating" style={style} {...attributes}>
      <p role="status">Rated {current} of 3</p>
      <button type="button" onClick={() => set(2)}>
        Two
      </button>
      <button type="button" onClick={() => set(3)}>
        Three
      </button>
    </section>
  );
}
