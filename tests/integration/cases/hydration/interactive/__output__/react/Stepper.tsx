import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useRef, useState } from "react";

export interface StepperProps {
  start?: number;
}

export interface StepperEvents {
  onChange?: (value: number) => void;
}

export interface StepperAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Stepper({
  start = 0,
  onChange,
  className,
  style,
  ...attributes
}: StepperProps & StepperEvents & StepperAttributes) {
  const [count, setCount] = useState(start);
  const countRef = useRef(count);

  function add() {
    countRef.current += 1;
    setCount(countRef.current);
    onChange?.(countRef.current);
  }

  return (
    <div className={cx("stepper", className)} style={style} {...scopeAttributes(attributes)}>
      <output>{count}</output>
      <button type="button" onClick={add}>
        Add one
      </button>
    </div>
  );
}
