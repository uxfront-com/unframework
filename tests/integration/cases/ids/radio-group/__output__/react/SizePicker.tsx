import { cx } from "./_unframework/cx";
import { listen } from "./_unframework/listen";
import { type ComponentPropsWithRef, useId, useRef, useState } from "react";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export type SizePickerAttributes = Omit<
  ComponentPropsWithRef<"fieldset">,
  "legend" | "sizes" | "children"
>;

export default function SizePicker({
  legend,
  sizes,
  className,
  style,
  ...attributes
}: SizePickerProps & SizePickerAttributes) {
  const group = `uf-id-${useId()}`;
  const hintId = `uf-id-${useId()}`;
  const [picked, setPicked] = useState("");
  const pickedRef = useRef(picked);

  function choose(size: string) {
    pickedRef.current = size;
    setPicked(pickedRef.current);
  }

  return (
    <fieldset
      className={cx("size-picker", className)}
      aria-describedby={hintId}
      style={style}
      {...attributes}
    >
      <legend>{legend}</legend>
      <p id={hintId}>Pick one size.</p>
      {sizes.map((size, index) => (
        <div key={size} className="size">
          <input
            type="radio"
            id={`${group}-${index}`}
            name={group}
            value={size}
            ref={(element) => listen(element, "change", () => choose(size))}
          />
          <label htmlFor={`${group}-${index}`}>{size}</label>
        </div>
      ))}
      <output>{picked || "none"}</output>
    </fieldset>
  );
}
