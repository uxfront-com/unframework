import { cx } from "./_unframework/cx";
import { useDirective } from "./_unframework/useDirective";
import { vRecord } from "./vRecord";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type MeterAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Meter({ className, style, ...attributes }: MeterAttributes) {
  const [level, setLevel] = useState(1);
  const levelRef = useRef(level);
  const [renders, setRenders] = useState(0);
  const rendersRef = useRef(renders);
  const recordRef = useDirective(vRecord, () => level);

  return (
    <section className={cx("meter", className)} aria-label="Meter" style={style} {...attributes}>
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
