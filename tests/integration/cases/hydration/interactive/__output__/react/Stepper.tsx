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
