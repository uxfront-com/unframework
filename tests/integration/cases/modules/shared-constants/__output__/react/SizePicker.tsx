import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
