import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface OptionsSlots<T extends { value: string }> {
  option?: (props: { option: T }) => JSX.Element;
}

export default function Options<T extends { value: string }>(
  props: { options: T[] } & OptionsSlots<T> &
    Omit<ComponentProps<"ul">, "options" | "option" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "options", "option");

  return (
    <ul {...others}>
      <KeyedFor each={props.options} by={(option) => option.value}>
        {(option) => <li>{props.option?.({ option: option.value })}</li>}
      </KeyedFor>
    </ul>
  );
}
