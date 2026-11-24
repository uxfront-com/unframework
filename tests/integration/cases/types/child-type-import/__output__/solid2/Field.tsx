import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface FieldProps {
  name: string;
  label: string;
}

export default function Field(
  props: FieldProps &
    Omit<ComponentProps<"label">, "name" | "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name", "label");

  return (
    <label {...others}>
      {props.label}
      <input name={props.name} />
    </label>
  );
}
