import { type ComponentPropsWithRef, useLayoutEffect, useRef, useState } from "react";

export interface ChoiceModels {
  picked?: string;
  onPickedChange?: (value: string) => void;
}

export type ChoiceAttributes = Omit<
  ComponentPropsWithRef<"button">,
  "picked" | "onPickedChange" | "children"
>;

export function Choice({
  picked: pickedProp,
  onPickedChange,
  className,
  style,
  onClick,
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
      onClick={(event) => {
        pickedRef.current = "yes";
        setLocalPicked({ value: pickedRef.current });
        onPickedChange?.(pickedRef.current);
        onClick?.(event);
      }}
      className={className}
      style={style}
      {...attributes}
    >
      Yes ({picked})
    </button>
  );
}
