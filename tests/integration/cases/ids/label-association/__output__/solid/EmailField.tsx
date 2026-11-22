import { type ComponentProps, type JSX, createUniqueId, splitProps } from "solid-js";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default function EmailField(
  props: EmailFieldProps &
    Omit<ComponentProps<"div">, "label" | "hint" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "hint", "class"]);

  const inputId = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;

  return (
    <div class={props.class ? `email-field ${props.class}` : "email-field"} {...others}>
      <label for={inputId}>{props.label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{props.hint}</p>
    </div>
  );
}
