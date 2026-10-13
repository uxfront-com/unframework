import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface ChoiceModels {
  picked?: string;
  onPickedChange?: (picked: string) => void;
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
}: ChoiceModels & ChoiceAttributes) {
  const [localPicked, setLocalPicked] = useState<string>("");
  const picked = pickedProp === undefined ? localPicked : pickedProp;
  const pickedRef = useRef(picked);

  useLayoutEffect(() => {
    pickedRef.current = picked;
  });

  return (
    <button
      type="button"
      onClick={() => {
        pickedRef.current = "yes";
        setLocalPicked(pickedRef.current);
        onPickedChange?.(pickedRef.current);
      }}
      className={className}
      style={style}
    >
      Yes ({picked})
    </button>
  );
}
