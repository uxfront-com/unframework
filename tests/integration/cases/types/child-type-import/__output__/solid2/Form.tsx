import Field, { type FieldProps } from "./Field";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Form(
  props: { field: FieldProps } & Omit<ComponentProps<"form">, "field" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "field");

  return (
    <form aria-label="Sign up" {...others}>
      <Field name={props.field.name} label={props.field.label} />
    </form>
  );
}
