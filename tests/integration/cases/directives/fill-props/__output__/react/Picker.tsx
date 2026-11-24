import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, type ReactNode, useRef, useState } from "react";

export interface PickerSlots {
  renderOption?: (props: { option: { id: string; label: string } }) => ReactNode;
}

export type PickerAttributes = Omit<ComponentPropsWithRef<"div">, "renderOption" | "children">;

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
    <div className={cx("picker", className)} style={style} {...attributes}>
      <ul aria-label="Options">
        {options.map((option) => (
          <li key={option.id}>{renderOption?.({ option })}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          optionsRef.current = optionsRef.current.map((option) =>
            option.id === "x" ? { id: "x", label: "Xenon" } : option,
          );
          setOptions(optionsRef.current);
        }}
      >
        Rename option
      </button>
    </div>
  );
}
