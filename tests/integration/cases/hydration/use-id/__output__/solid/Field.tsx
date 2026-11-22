import { type ComponentProps, type JSX, createUniqueId, splitProps } from "solid-js";

export interface FieldProps {
  label: string;
  hint: string;
}

export default function Field(
  props: FieldProps &
    Omit<ComponentProps<"p">, "label" | "hint" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "hint", "class"]);

  const inputId = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;

  return (
    <p class={props.class ? `field ${props.class}` : "field"} {...others}>
      <label for={inputId}>{props.label}</label>
      <input id={inputId} type="text" aria-describedby={hintId} />
      <small id={hintId}>{props.hint}</small>
    </p>
  );
}
