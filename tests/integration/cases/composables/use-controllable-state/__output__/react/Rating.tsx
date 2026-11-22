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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
