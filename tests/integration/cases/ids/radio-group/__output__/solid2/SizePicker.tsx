import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createUniqueId, omit } from "solid-js";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default function SizePicker(
  props: SizePickerProps &
    Omit<ComponentProps<"fieldset">, "legend" | "sizes" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "legend", "sizes", "class");

  const group = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;
  const [picked, setPicked] = createState("");

  function choose(size: string) {
    setPicked(size);
  }

  return (
    <fieldset
      class={props.class ? `size-picker ${props.class}` : "size-picker"}
      aria-describedby={enumeratedValue(hintId)}
      {...others}
    >
      <legend>{props.legend}</legend>
      <p id={hintId}>Pick one size.</p>
      <KeyedFor each={props.sizes} by={(size) => size}>
        {(size) => (
          <div class="size">
            <input
              type="radio"
              id={`${group}-${size.index}`}
              name={group}
              value={size.value}
              onChange={() => choose(size.value)}
            />
            <label for={`${group}-${size.index}`}>{size.value}</label>
          </div>
        )}
      </KeyedFor>
      <output>{picked() || "none"}</output>
    </fieldset>
  );
}
