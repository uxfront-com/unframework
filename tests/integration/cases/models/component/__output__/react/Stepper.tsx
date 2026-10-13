import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface StepperModels {
  value?: number;
  onValueChange?: (value: number) => void;
}

export interface StepperAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Stepper({
  label,
  value: valueProp,
  onValueChange,
  className,
  style,
}: { label: string } & StepperModels & StepperAttributes) {
  const [localValue, setLocalValue] = useState<number>(0);
  const value = valueProp === undefined ? localValue : valueProp;
  const valueRef = useRef(value);

  useLayoutEffect(() => {
    valueRef.current = value;
  });

  return (
    <div className={cx("stepper", className)} style={style}>
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick={() => {
          valueRef.current -= 1;
          setLocalValue(valueRef.current);
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
          setLocalValue(valueRef.current);
          onValueChange?.(valueRef.current);
        }}
      >
        +
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
