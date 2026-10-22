import Counter from "./Counter";
import { type CSSProperties, useRef } from "react";

export interface ControlsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Controls({ className, style, ...attributes }: ControlsAttributes) {
  const counter = useRef<{ increment(): void; reset(): void }>(null);

  return (
    <div className={cx("controls", className)} style={style} {...scopeAttributes(attributes)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
