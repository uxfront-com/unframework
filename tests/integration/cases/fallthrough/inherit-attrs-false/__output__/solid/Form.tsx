import Field from "./Field";
import type { ComponentProps, JSX } from "solid-js";

export default function Form(
  props: Omit<ComponentProps<"form">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <form aria-label="Sign up" {...props}>
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
}
