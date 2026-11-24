import Counter from "./Counter";
import { type ComponentPropsWithRef, useRef } from "react";

export type ControlsAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Controls({ className, style, ...attributes }: ControlsAttributes) {
  const counter = useRef<{ increment(): void; reset(): void }>(null);

  return (
    <div className={cx("controls", className)} style={style} {...attributes}>
      <Counter ref={counter} start={10} />
      <button type="button" onClick={() => counter.current?.increment()}>
        More
      </button>
      <button type="button" onClick={() => counter.current?.reset()}>
        Reset
      </button>
    </div>
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
