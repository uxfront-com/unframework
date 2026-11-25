import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface PickerSlots {
  option?: (props: { option: { id: string; label: string } }) => JSX.Element;
}

export default function Picker(
  props: PickerSlots &
    Omit<ComponentProps<"div">, "option" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "option", "class");

  const [options, setOptions] = createState([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  return (
    <div class={props.class ? `picker ${props.class}` : "picker"} {...others}>
      <ul aria-label="Options">
        <KeyedFor each={options()} by={(option) => option.id}>
          {(option) => <li>{props.option?.({ option: option.value })}</li>}
        </KeyedFor>
      </ul>
      <button type="button" onClick={() => setOptions([...options()].reverse())}>
        Reverse options
      </button>
      <button
        type="button"
        onClick={() => setOptions(options().filter((option) => option.id !== "y"))}
      >
        Remove option
      </button>
    </div>
  );
}
