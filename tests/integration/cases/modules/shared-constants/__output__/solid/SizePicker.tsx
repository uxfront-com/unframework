import { KeyedFor } from "./_unframework/KeyedFor";
import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function SizePicker(
  props: Omit<ComponentProps<"fieldset">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [size, setSize] = createSignal<Size>(DEFAULT_SIZE);

  function pick(next: Size) {
    setSize(next);
  }

  return (
    <fieldset class={props.class ? `size-picker ${props.class}` : "size-picker"} {...others}>
      <legend>Size</legend>
      <p role="status">Picked: {SIZES[size()]}</p>
      <ul>
        <KeyedFor each={SIZE_ORDER} by={(each) => each}>
          {(each) => (
            <li>
              <button
                type="button"
                aria-pressed={size() === each.value}
                onClick={() => pick(each.value)}
              >
                {SIZES[each.value]}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
    </fieldset>
  );
}
