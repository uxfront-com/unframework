import Field, { type FieldProps } from "./Field";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { field: FieldProps } & Omit<PropsOf<"form">, "field" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ field, class: className, style, ...attributes }) => {
  return (
    <form aria-label="Sign up" class={className} style={style} {...attributes}>
      <Field name={field.name} label={field.label} />
    </form>
  );
});
