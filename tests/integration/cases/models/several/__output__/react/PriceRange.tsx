import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface PriceRangeModels {
  min?: number;
  onMinChange?: (value: number) => void;
  max?: number;
  onMaxChange?: (value: number) => void;
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
  ...attributes
}: { label: string } & PriceRangeModels & PriceRangeAttributes) {
  const [localMin, setLocalMin] = useState<{ value: number }>({ value: 0 });
  const min = minProp === undefined ? localMin.value : minProp;
  const minRef = useRef(min);

  useLayoutEffect(() => {
    minRef.current = min;
  });

  const [localMax, setLocalMax] = useState<{ value: number }>({ value: 100 });
  const max = maxProp === undefined ? localMax.value : maxProp;
  const maxRef = useRef(max);

  useLayoutEffect(() => {
    maxRef.current = max;
  });

  function widen() {
    minRef.current -= 10;
    setLocalMin({ value: minRef.current });
    onMinChange?.(minRef.current);
    maxRef.current += 10;
    setLocalMax({ value: maxRef.current });
    onMaxChange?.(maxRef.current);
  }

  return (
    <fieldset className={className} style={style} {...scopeAttributes(attributes)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
