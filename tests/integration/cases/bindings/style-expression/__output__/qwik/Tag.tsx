import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface TagProps {
  label: string;
  tone?: string;
}

export default component$<
  TagProps &
    Omit<PropsOf<"em">, "label" | "tone" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, tone: _tone, ...attributes }) => {
  return (
    <em
      class={["tag", className]}
      style={{ color: "rgb(120, 30, 30)", padding: "1px 4px", ...style }}
      {...attributes}
    >
      {label}
    </em>
  );
});
