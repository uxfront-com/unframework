import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import { type CSSProperties, useRef, useState } from "react";

export interface SizePickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SizePicker({ className, style, ...attributes }: SizePickerAttributes) {
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const sizeRef = useRef(size);

  function pick(next: Size) {
    sizeRef.current = next;
    setSize(sizeRef.current);
  }

  return (
    <fieldset
      className={cx("size-picker", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <legend>Size</legend>
      <p role="status">Picked: {SIZES[size]}</p>
      <ul>
        {SIZE_ORDER.map((each) => (
          <li key={each}>
            <button type="button" aria-pressed={size === each} onClick={() => pick(each)}>
              {SIZES[each]}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
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
