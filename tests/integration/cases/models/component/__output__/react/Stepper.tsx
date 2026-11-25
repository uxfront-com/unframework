import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useLayoutEffect, useRef, useState } from "react";

export interface StepperModels {
  value?: number;
  onValueChange?: (value: number) => void;
}

export type StepperAttributes = Omit<
  ComponentPropsWithRef<"div">,
  "label" | "value" | "onValueChange" | "children"
>;

export default function Stepper({
  label,
  value: valueProp,
  onValueChange,
  className,
  style,
  ...attributes
}: { label: string } & StepperModels & StepperAttributes) {
  const [localValue, setLocalValue] = useState<{ value: number }>({ value: 0 });
  const value = valueProp === undefined ? localValue.value : valueProp;
  const valueRef = useRef(value);

  useLayoutEffect(() => {
    valueRef.current = value;
  });

  return (
    <div className={cx("stepper", className)} style={style} {...attributes}>
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick={() => {
          valueRef.current -= 1;
          setLocalValue({ value: valueRef.current });
          onValueChange?.(valueRef.current);
        }}
      >
        -
      </button>
      <span>
        {label}: {value}
      </span>
      <button
        type="button"
        aria-label={`More ${label}`}
        onClick={() => {
          valueRef.current += 1;
          setLocalValue({ value: valueRef.current });
          onValueChange?.(valueRef.current);
        }}
      >
        +
      </button>
    </div>
  );
}
