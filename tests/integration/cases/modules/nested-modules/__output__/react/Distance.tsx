import { formatDistance } from "./format";
import type { Unit } from "./units";
import { type CSSProperties, useRef, useState } from "react";

export interface DistanceAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Distance({
  value,
  className,
  style,
  ...attributes
}: { value: number } & DistanceAttributes) {
  const [unit, setUnit] = useState<Unit>("km");
  const unitRef = useRef(unit);

  return (
    <section
      className={cx("distance", className)}
      aria-label="Distance"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p role="status">{formatDistance(value, unit)}</p>
      <button
        type="button"
        onClick={() => {
          unitRef.current = unitRef.current === "km" ? "mi" : "km";
          setUnit(unitRef.current);
        }}
      >
        Switch units
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
