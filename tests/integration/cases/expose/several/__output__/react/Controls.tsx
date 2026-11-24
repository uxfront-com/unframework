import Counter from "./Counter";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
