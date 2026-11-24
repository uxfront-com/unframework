import Field from "./Field";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"form">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <form aria-label="Sign up" class={className} style={style} {...attributes}>
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
});
