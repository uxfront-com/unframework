import type { FieldOptions } from "./types";
import type { JSX } from "solid-js";

export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
  Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;

export default function TextField(
  props: TextFieldProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <label class={props.class} style={props.style} {...scopeAttributes(props)}>
      {props.label}
      <input name={props.name} placeholder={props.placeholder} required={props.required} />
    </label>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
