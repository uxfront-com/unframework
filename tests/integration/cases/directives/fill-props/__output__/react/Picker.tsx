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
