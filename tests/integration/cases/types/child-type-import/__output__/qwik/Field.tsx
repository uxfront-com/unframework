import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface FieldProps {
  name: string;
  label: string;
}

export default component$<
  FieldProps &
    Omit<PropsOf<"label">, "name" | "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, label, class: className, style, ...attributes }) => {
  return (
    <label class={className} style={style} {...attributes}>
      {label}
      <input name={name} />
    </label>
  );
});
