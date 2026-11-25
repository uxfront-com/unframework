import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function SizePicker(
  props: Omit<ComponentProps<"fieldset">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [size, setSize] = createState<Size>(DEFAULT_SIZE);

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
                aria-pressed={enumeratedValue(size() === each.value)}
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
