import type { ComponentProps, JSX } from "@solidjs/web";
import { createUniqueId, omit } from "solid-js";

export interface FieldProps {
  label: string;
  hint: string;
}

export default function Field(
  props: FieldProps &
    Omit<ComponentProps<"p">, "label" | "hint" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "hint", "class");

  const inputId = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;

  return (
    <p class={props.class ? `field ${props.class}` : "field"} {...others}>
      <label for={inputId}>{props.label}</label>
      <input id={inputId} type="text" aria-describedby={enumeratedValue(hintId)} />
      <small id={hintId}>{props.hint}</small>
    </p>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}
