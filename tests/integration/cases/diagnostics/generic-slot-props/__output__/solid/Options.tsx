import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface OptionsSlots<T extends { value: string }> {
  option?: (props: { option: T }) => JSX.Element;
}

export default function Options<T extends { value: string }>(
  props: { options: T[] } & OptionsSlots<T> &
    Omit<ComponentProps<"ul">, "options" | "option" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["options", "option"]);

  return (
    <ul {...others}>
      <KeyedFor each={props.options} by={(option) => option.value}>
        {(option) => <li>{props.option?.({ option: option.value })}</li>}
      </KeyedFor>
    </ul>
  );
}
