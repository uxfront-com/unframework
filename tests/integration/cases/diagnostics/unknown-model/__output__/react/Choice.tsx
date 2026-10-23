import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface ChoiceModels {
  picked?: string;
  onPickedChange?: (value: string) => void;
}

export interface ChoiceAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Choice({
  picked: pickedProp,
  onPickedChange,
  className,
  style,
  ...attributes
}: ChoiceModels & ChoiceAttributes) {
  const [localPicked, setLocalPicked] = useState<{ value: string }>({ value: "" });
  const picked = pickedProp === undefined ? localPicked.value : pickedProp;
  const pickedRef = useRef(picked);

  useLayoutEffect(() => {
    pickedRef.current = picked;
  });

  return (
    <button
      type="button"
      onClick={() => {
        pickedRef.current = "yes";
        setLocalPicked({ value: pickedRef.current });
        onPickedChange?.(pickedRef.current);
      }}
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      Yes ({picked})
    </button>
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
