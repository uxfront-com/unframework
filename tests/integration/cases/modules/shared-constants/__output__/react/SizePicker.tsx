import { cx } from "./_unframework/cx";
import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type SizePickerAttributes = Omit<ComponentPropsWithRef<"fieldset">, "children">;

export default function SizePicker({ className, style, ...attributes }: SizePickerAttributes) {
  const [size, setSize] = useState<Size>(DEFAULT_SIZE);
  const sizeRef = useRef(size);

  function pick(next: Size) {
    sizeRef.current = next;
    setSize(sizeRef.current);
  }

  return (
    <fieldset className={cx("size-picker", className)} style={style} {...attributes}>
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
