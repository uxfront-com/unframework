import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface FieldProps {
  name: string;
  label: string;
}

export default function Field(
  props: FieldProps &
    Omit<ComponentProps<"label">, "name" | "label" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["name", "label"]);

  return (
    <label {...others}>
      {props.label}
      <input name={props.name} />
    </label>
  );
}
