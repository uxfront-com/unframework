import Counter from "./Counter";
import { cx } from "./_unframework/cx";
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
