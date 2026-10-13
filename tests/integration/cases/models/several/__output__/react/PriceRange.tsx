import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface PriceRangeModels {
  min?: number;
  onMinChange?: (min: number) => void;
  max?: number;
  onMaxChange?: (max: number) => void;
}

export interface PriceRangeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function PriceRange({
  label,
  min: minProp,
  onMinChange,
  max: maxProp,
  onMaxChange,
  className,
  style,
}: { label: string } & PriceRangeModels & PriceRangeAttributes) {
  const [localMin, setLocalMin] = useState<number>(0);
  const min = minProp === undefined ? localMin : minProp;
  const minRef = useRef(min);

  useLayoutEffect(() => {
    minRef.current = min;
  });

  const [localMax, setLocalMax] = useState<number>(100);
  const max = maxProp === undefined ? localMax : maxProp;
  const maxRef = useRef(max);

  useLayoutEffect(() => {
    maxRef.current = max;
  });

  function widen() {
    minRef.current -= 10;
    setLocalMin(minRef.current);
    onMinChange?.(minRef.current);
    maxRef.current += 10;
    setLocalMax(maxRef.current);
    onMaxChange?.(maxRef.current);
  }

  return (
    <fieldset className={className} style={style}>
      <legend>{label}</legend>
      <p>
        From {min} to {max}
      </p>
      <button type="button" onClick={widen}>
        Widen
      </button>
    </fieldset>
  );
}
