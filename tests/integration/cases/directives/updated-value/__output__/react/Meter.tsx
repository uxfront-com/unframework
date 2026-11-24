import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { vRecord } from "./vRecord";
import { type CSSProperties, useRef, useState } from "react";

export interface MeterAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Meter({ className, style, ...attributes }: MeterAttributes) {
  const [level, setLevel] = useState(1);
  const levelRef = useRef(level);
  const [renders, setRenders] = useState(0);
  const rendersRef = useRef(renders);
  const recordRef = useDirective(vRecord, () => level);

  return (
    <section
      className={cx("meter", className)}
      aria-label="Meter"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <output className="level" ref={recordRef}>
        Level {level}
      </output>
      <p>Rendered again {renders} times</p>
      <button
        type="button"
        onClick={() => {
          levelRef.current++;
          setLevel(levelRef.current);
        }}
      >
        Raise
      </button>
      <button
        type="button"
        onClick={() => {
          rendersRef.current++;
          setRenders(rendersRef.current);
        }}
      >
        Render again
      </button>
    </section>
  );
}
