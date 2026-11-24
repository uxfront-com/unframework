import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
