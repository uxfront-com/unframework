import Field from "./Field";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Form(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return (
    <form aria-label="Sign up" {...props}>
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
}
