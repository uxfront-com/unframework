import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";

export interface PickerSlots {
  renderOption?: (props: { option: { id: string; label: string } }) => ReactNode;
}

export interface PickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Picker({
  renderOption,
  className,
  style,
  ...attributes
}: PickerSlots & PickerAttributes) {
  const [options, setOptions] = useState([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);
  const optionsRef = useRef(options);

  return (
    <div className={cx("picker", className)} style={style} {...scopeAttributes(attributes)}>
      <ul aria-label="Options">
        {options.map((option) => (
          <li key={option.id}>{renderOption?.({ option })}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          optionsRef.current = [...optionsRef.current].reverse();
          setOptions(optionsRef.current);
        }}
      >
        Reverse options
      </button>
      <button
        type="button"
        onClick={() => {
          optionsRef.current = optionsRef.current.filter((option) => option.id !== "y");
          setOptions(optionsRef.current);
        }}
      >
        Remove option
      </button>
    </div>
  );
}
