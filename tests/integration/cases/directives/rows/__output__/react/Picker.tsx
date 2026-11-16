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
          optionsRef.current = optionsRef.current.map((option) =>
            option.id === "x" ? { id: "x", label: "Xenon" } : option,
          );
          setOptions(optionsRef.current);
        }}
      >
        Rename option
      </button>
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
