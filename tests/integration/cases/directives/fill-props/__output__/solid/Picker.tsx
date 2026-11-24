import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface PickerSlots {
  option?: (props: { option: { id: string; label: string } }) => JSX.Element;
}

export default function Picker(
  props: PickerSlots &
    Omit<ComponentProps<"div">, "option" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["option", "class"]);

  const [options, setOptions] = createSignal([
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
      <button
        type="button"
        onClick={() =>
          setOptions(
            options().map((option) => (option.id === "x" ? { id: "x", label: "Xenon" } : option)),
          )
        }
      >
        Rename option
      </button>
    </div>
  );
}
