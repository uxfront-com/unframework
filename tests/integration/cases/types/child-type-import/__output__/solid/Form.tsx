import Field, { type FieldProps } from "./Field";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Form(
  props: { field: FieldProps } & Omit<ComponentProps<"form">, "field" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["field"]);

  return (
    <form aria-label="Sign up" {...others}>
      <Field name={props.field.name} label={props.field.label} />
    </form>
  );
}
