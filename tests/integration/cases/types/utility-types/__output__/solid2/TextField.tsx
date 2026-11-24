import type { FieldOptions } from "./types";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
  Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;

export default function TextField(
  props: TextFieldProps &
    Omit<
      ComponentProps<"label">,
      "name" | "label" | "placeholder" | "required" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "name", "label", "placeholder", "required");

  return (
    <label {...others}>
      {props.label}
      <input name={props.name} placeholder={props.placeholder} required={props.required} />
    </label>
  );
}
