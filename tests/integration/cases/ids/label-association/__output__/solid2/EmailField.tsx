import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createUniqueId, omit } from "solid-js";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default function EmailField(
  props: EmailFieldProps &
    Omit<ComponentProps<"div">, "label" | "hint" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "hint", "class");

  const inputId = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;

  return (
    <div class={props.class ? `email-field ${props.class}` : "email-field"} {...others}>
      <label for={inputId}>{props.label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={enumeratedValue(hintId)} />
      <p id={hintId}>{props.hint}</p>
    </div>
  );
}
