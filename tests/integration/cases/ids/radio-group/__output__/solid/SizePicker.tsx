import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, createUniqueId, splitProps } from "solid-js";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default function SizePicker(
  props: SizePickerProps &
    Omit<ComponentProps<"fieldset">, "legend" | "sizes" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["legend", "sizes", "class"]);

  const group = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;
  const [picked, setPicked] = createSignal("");

  function choose(size: string) {
    setPicked(size);
  }

  return (
    <fieldset
      class={props.class ? `size-picker ${props.class}` : "size-picker"}
      aria-describedby={hintId}
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
