import { cx } from "./_unframework/cx";
import { formatDistance } from "./format";
import type { Unit } from "./units";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type DistanceAttributes = Omit<ComponentPropsWithRef<"section">, "value" | "children">;

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
      {...attributes}
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
